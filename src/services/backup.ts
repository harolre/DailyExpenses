import { database } from '../data/database'
import type { Account, Budget, Category, DocumentRecord, Movement, Profile, RecurringItem, TrashRecord } from '../models/entities'

const MAGIC = new Uint8Array([70, 66, 75, 49])
const SALT_LENGTH = 16
const IV_LENGTH = 12
const PBKDF2_ITERATIONS = 250_000

type EncodedDocument = Omit<DocumentRecord, 'blob'> & { base64: string }
export type BackupSnapshot = {
  accounts: Account[]
  categories: Category[]
  movements: Movement[]
  recurringItems: RecurringItem[]
  budgets: Budget[]
  documents: DocumentRecord[]
  trash: TrashRecord[]
  profiles: Profile[]
}
type BackupPayload = Omit<BackupSnapshot, 'documents' | 'trash'> & {
  format?: 'finanzas-backup'
  version?: number
  exportedAt?: string
  documents?: EncodedDocument[]
  trash?: Array<Omit<TrashRecord, 'documents'> & { documents: EncodedDocument[] }>
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function encodeDocument(document: DocumentRecord): Promise<EncodedDocument> {
  return { id: document.id, movementId: document.movementId, name: document.name, type: document.type, createdAt: document.createdAt, base64: bytesToBase64(new Uint8Array(await document.blob.arrayBuffer())) }
}

async function deriveKey(password: string, salt: Uint8Array, usage: 'encrypt' | 'decrypt') {
  const passwordKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, passwordKey, { name: 'AES-GCM', length: 256 }, false, [usage])
}

export async function createEncryptedBackup(password: string) {
  const [accounts, categories, movements, recurringItems, budgets, documents, trashRecords, profiles] = await Promise.all([
    database.accounts.toArray(), database.categories.toArray(), database.movements.toArray(), database.recurringItems.toArray(), database.budgets.toArray(), database.documents.toArray(), database.trash.toArray(), database.profiles.toArray(),
  ])
  const [encodedDocuments, encodedTrash] = await Promise.all([
    Promise.all(documents.map(encodeDocument)),
    Promise.all(trashRecords.map(async record => ({ ...record, documents: await Promise.all(record.documents.map(encodeDocument)) }))),
  ])
  const payload: BackupPayload = { format: 'finanzas-backup', version: 1, exportedAt: new Date().toISOString(), accounts, categories, movements, recurringItems, budgets, documents: encodedDocuments, trash: encodedTrash, profiles }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt, 'encrypt')
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload))))
  const bytes = new Uint8Array(MAGIC.length + SALT_LENGTH + IV_LENGTH + encrypted.length)
  bytes.set(MAGIC, 0)
  bytes.set(salt, MAGIC.length)
  bytes.set(iv, MAGIC.length + SALT_LENGTH)
  bytes.set(encrypted, MAGIC.length + SALT_LENGTH + IV_LENGTH)
  return new Blob([bytes], { type: 'application/octet-stream' })
}

function decodeDocument(document: EncodedDocument): DocumentRecord {
  if (!document || typeof document.id !== 'string' || typeof document.movementId !== 'string' || typeof document.base64 !== 'string') throw new Error('Documento inválido')
  return { id: document.id, movementId: document.movementId, name: document.name, type: document.type, createdAt: document.createdAt, blob: new Blob([base64ToBytes(document.base64)], { type: document.type }) }
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function isArray(value: unknown): value is unknown[] { return Array.isArray(value) }

export async function readEncryptedBackup(file: File, password: string): Promise<BackupSnapshot> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isCurrentFormat = MAGIC.every((value, index) => bytes[index] === value)
  const headerLength = (isCurrentFormat ? MAGIC.length : 0) + SALT_LENGTH + IV_LENGTH
  if (bytes.length <= headerLength) throw new Error('El archivo de copia está incompleto.')
  const saltOffset = isCurrentFormat ? MAGIC.length : 0
  const salt = bytes.slice(saltOffset, saltOffset + SALT_LENGTH)
  const iv = bytes.slice(saltOffset + SALT_LENGTH, headerLength)
  const key = await deriveKey(password, salt, 'decrypt')
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, bytes.slice(headerLength))
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext))
  if (!isRecord(parsed) || !isArray(parsed.accounts) || !isArray(parsed.categories) || !isArray(parsed.movements)) throw new Error('El archivo no contiene una copia válida.')
  if (parsed.format === 'finanzas-backup' && parsed.version !== 1) throw new Error('Esta versión de copia no es compatible.')

  const documents = (isArray(parsed.documents) ? parsed.documents : []).map(document => decodeDocument(document as EncodedDocument))
  const trash = (isArray(parsed.trash) ? parsed.trash : []).map(record => {
    if (!isRecord(record) || !isRecord(record.movement) || typeof record.id !== 'string' || typeof record.deletedAt !== 'string') throw new Error('Registro de papelera inválido')
    return { id: record.id, movement: record.movement as unknown as Movement, deletedAt: record.deletedAt, documents: (isArray(record.documents) ? record.documents : []).map(document => decodeDocument(document as EncodedDocument)) }
  })
  const currentProfile = await database.profiles.get('local')
  const profiles = isArray(parsed.profiles) ? parsed.profiles as Profile[] : currentProfile ? [currentProfile] : []
  return {
    accounts: parsed.accounts as Account[], categories: parsed.categories as Category[], movements: parsed.movements as Movement[],
    recurringItems: isArray(parsed.recurringItems) ? parsed.recurringItems as RecurringItem[] : [],
    budgets: isArray(parsed.budgets) ? parsed.budgets as Budget[] : [], documents, trash, profiles,
  }
}

export async function restoreBackup(snapshot: BackupSnapshot) {
  await database.transaction('rw', [database.accounts, database.categories, database.movements, database.recurringItems, database.budgets, database.documents, database.trash, database.profiles], async () => {
    await Promise.all([database.accounts.clear(), database.categories.clear(), database.movements.clear(), database.recurringItems.clear(), database.budgets.clear(), database.documents.clear(), database.trash.clear(), database.profiles.clear()])
    await Promise.all([
      database.accounts.bulkPut(snapshot.accounts), database.categories.bulkPut(snapshot.categories), database.movements.bulkPut(snapshot.movements),
      database.recurringItems.bulkPut(snapshot.recurringItems), database.budgets.bulkPut(snapshot.budgets), database.documents.bulkPut(snapshot.documents),
      database.trash.bulkPut(snapshot.trash), database.profiles.bulkPut(snapshot.profiles),
    ])
  })
}
