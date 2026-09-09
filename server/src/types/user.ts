export type UserRole = 'host' | 'admin' | 'joiner'

export type RoomUser = {
  id: string
  name: string
  role: UserRole
}