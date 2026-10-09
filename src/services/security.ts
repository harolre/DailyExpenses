const storageKey = 'finanzas.pin-credential'
const biometricKey = 'finanzas.biometric-credential'

function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)) }
function decode(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)) }
function credential() {
  try { return JSON.parse(localStorage.getItem(storageKey) || 'null') as { salt: string; hash: string } | null }
  catch { return null }
}

export function hasPin() { return credential() !== null }

async function derive(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' }, material, 256))
}

export async function setPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt)
  localStorage.setItem(storageKey, JSON.stringify({ salt: encode(salt), hash: encode(hash) }))
}

export async function verifyPin(pin: string) {
  const saved = credential()
  if (!saved) return false
  const actual = await derive(pin, decode(saved.salt))
  const expected = decode(saved.hash)
  if (actual.length !== expected.length) return false
  let difference = 0
  for (let index=0;index<actual.length;index+=1) difference |= actual[index] ^ expected[index]
  return difference === 0
}

export function removePin() { localStorage.removeItem(storageKey) }

type BiometricCredential = { id: string; publicKey: string; algorithm: number; rpId: string }
function biometricCredential(): BiometricCredential | null {
  try { return JSON.parse(localStorage.getItem(biometricKey) || 'null') as BiometricCredential | null }
  catch { return null }
}
export function hasBiometric() { return biometricCredential() !== null }
export function removeBiometric() { localStorage.removeItem(biometricKey) }

function encodeUrl(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') }
function decodeUrl(value: string) { const base=value.replaceAll('-', '+').replaceAll('_', '/');const padded=base+'='.repeat((4-base.length%4)%4);return Uint8Array.from(atob(padded),char=>char.charCodeAt(0)) }
function ecdsaDerToRaw(signature: ArrayBuffer) {
  const bytes=new Uint8Array(signature)
  if(bytes[0]!==0x30)return bytes
  let offset=2
  if(bytes[offset]!==0x02)throw new Error('Firma biométrica no válida.')
  const rLength=bytes[offset+1];offset+=2;let r=bytes.slice(offset,offset+rLength);offset+=rLength
  if(bytes[offset]!==0x02)throw new Error('Firma biométrica no válida.')
  const sLength=bytes[offset+1];offset+=2;let s=bytes.slice(offset,offset+sLength)
  if(r[0]===0)r=r.slice(1);if(s[0]===0)s=s.slice(1)
  const raw=new Uint8Array(64);raw.set(r.slice(-32),32-Math.min(32,r.length));raw.set(s.slice(-32),64-Math.min(32,s.length));return raw
}

export async function platformAuthenticatorAvailable() {
  if (!window.PublicKeyCredential || !navigator.credentials) return false
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() }
  catch { return false }
}

export async function registerBiometric() {
  if (!await platformAuthenticatorAvailable() || !hasPin()) throw new Error('Configura primero un PIN y comprueba que el dispositivo admita biometría.')
  const challenge=crypto.getRandomValues(new Uint8Array(32));const userId=crypto.getRandomValues(new Uint8Array(16));const rpId=location.hostname
  const credential=await navigator.credentials.create({publicKey:{challenge,rp:{name:'Finanzas personales',id:rpId},user:{id:userId,name:'usuario-local',displayName:'Usuario local'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',userVerification:'required'},timeout:60_000,attestation:'none'}})
  if (!(credential instanceof PublicKeyCredential)) throw new Error('No se pudo registrar el sensor del dispositivo.')
  const response=credential.response as AuthenticatorAttestationResponse & {getPublicKey:()=>ArrayBuffer|null;getPublicKeyAlgorithm:()=>number}
  const clientData=JSON.parse(new TextDecoder().decode(response.clientDataJSON)) as {type:string;challenge:string;origin:string}
  if(clientData.type!=='webauthn.create'||clientData.challenge!==encodeUrl(challenge)||clientData.origin!==location.origin)throw new Error('La respuesta de autenticación no coincide con esta app.')
  const key=response.getPublicKey();const algorithm=response.getPublicKeyAlgorithm()
  if (!key || ![-7,-257].includes(algorithm)) throw new Error('El dispositivo devolvió una clave de autenticación no compatible.')
  localStorage.setItem(biometricKey,JSON.stringify({id:encodeUrl(new Uint8Array(credential.rawId)),publicKey:encodeUrl(new Uint8Array(key)),algorithm,rpId}))
}

export async function verifyBiometric() {
  const saved=biometricCredential();if(!saved||!navigator.credentials)return false
  const challenge=crypto.getRandomValues(new Uint8Array(32))
  const assertion=await navigator.credentials.get({publicKey:{challenge,rpId:saved.rpId,allowCredentials:[{type:'public-key',id:decodeUrl(saved.id)}],userVerification:'required',timeout:60_000}})
  if (!(assertion instanceof PublicKeyCredential)) return false
  const response=assertion.response as AuthenticatorAssertionResponse
  const clientData=JSON.parse(new TextDecoder().decode(response.clientDataJSON)) as {type:string;challenge:string;origin:string}
  if(clientData.type!=='webauthn.get'||clientData.challenge!==encodeUrl(challenge)||clientData.origin!==location.origin)return false
  const authenticatorData=new Uint8Array(response.authenticatorData)
  if((authenticatorData[32]&0x05)!==0x05)return false
  const expectedRpHash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(saved.rpId)))
  if(!expectedRpHash.every((byte,index)=>byte===authenticatorData[index]))return false
  const clientHash=new Uint8Array(await crypto.subtle.digest('SHA-256',response.clientDataJSON))
  const signed=new Uint8Array(authenticatorData.length+clientHash.length);signed.set(authenticatorData);signed.set(clientHash,authenticatorData.length)
  const algorithm=saved.algorithm===-7?{name:'ECDSA',namedCurve:'P-256'} as const:{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'} as const
  const verifyAlgorithm=saved.algorithm===-7?{name:'ECDSA',hash:'SHA-256'}:{name:'RSASSA-PKCS1-v1_5'}
  const key=await crypto.subtle.importKey('spki',decodeUrl(saved.publicKey),algorithm,false,['verify'])
  const signature=saved.algorithm===-7?ecdsaDerToRaw(response.signature):response.signature
  return crypto.subtle.verify(verifyAlgorithm,key,signature,signed)
}
