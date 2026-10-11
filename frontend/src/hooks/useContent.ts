import { content, type ContentKey } from '../content'

export function useContent<Key extends ContentKey>(key: Key): (typeof content)[Key] {
  return content[key]
}
