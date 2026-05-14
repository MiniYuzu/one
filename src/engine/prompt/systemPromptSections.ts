// src/engine/prompt/systemPromptSections.ts
type ComputeFn = () => string | null | Promise<string | null>

export type SystemPromptSection = {
  name: string
  compute: ComputeFn
  cacheBreak: boolean
}

const sectionCache = new Map<string, string | null>()

export function systemPromptSection(
  name: string,
  compute: ComputeFn,
): SystemPromptSection {
  return { name, compute, cacheBreak: false }
}

export function DANGEROUS_uncachedSystemPromptSection(
  name: string,
  compute: ComputeFn,
  _reason: string,
): SystemPromptSection {
  return { name, compute, cacheBreak: true }
}

export async function resolveSystemPromptSections(
  sections: SystemPromptSection[],
): Promise<(string | null)[]> {
  return Promise.all(
    sections.map(async s => {
      if (!s.cacheBreak && sectionCache.has(s.name)) {
        return sectionCache.get(s.name) ?? null
      }
      const value = await s.compute()
      sectionCache.set(s.name, value)
      return value
    }),
  )
}

export function clearSystemPromptSections(): void {
  sectionCache.clear()
}
