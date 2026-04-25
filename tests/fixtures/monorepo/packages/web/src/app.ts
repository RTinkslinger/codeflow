import { getUser } from '../../api/src/index.js'
export function renderUser(id: string) { return getUser(id) }
