export interface ReportedDetail {
  school_name: string
  teacher_name: string
  reference_number: string
  exact_text: string
  submission_id?: string
}

export interface CompetencyInputItem {
  text: string
  school_name?: string
  teacher_name?: string
  reference_number?: string
  submission_id?: string
}

export interface GroupedCompetency {
  competency_text: string
  count: number
  raw_texts: string[]
  reported_details: ReportedDetail[]
}

/**
 * Normalizes and groups similar competencies that express the same core thought / stem,
 * merging slight sentence variations into one entry with combined frequency counts,
 * retaining full school/teacher reporting details for audit and inspection.
 */
export function groupAndDeduplicateCompetencies(
  inputs: (string | CompetencyInputItem)[]
): GroupedCompetency[] {
  if (!inputs || inputs.length === 0) return []

  // Normalize input into unified objects
  const items: CompetencyInputItem[] = inputs
    .map(item => typeof item === 'string' ? { text: item } : item)
    .filter(item => item && item.text && item.text.trim())

  // 1. Helper to extract base stem (text before colon, asterisk, or first 50 chars)
  const getStem = (str: string): string => {
    let clean = str.trim().toLowerCase()
    // If there is a colon, take stem before colon if >= 8 chars
    const colonIdx = clean.indexOf(':')
    if (colonIdx >= 8) {
      clean = clean.slice(0, colonIdx)
    }
    // Remove bullet indicators, numbers like 1., (a), symbols
    return clean
      .replace(/[\*\-\_]/g, ' ')
      .replace(/\b\d+[\.\)]\s*/g, '')
      .replace(/\([a-z0-9]+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // 2. Helper to get normalized word tokens for Jaccard/overlap similarity
  const getTokens = (str: string): Set<string> => {
    const clean = str
      .toLowerCase()
      .replace(/[\*\-\_\:\.\,\(\)]/g, ' ')
      .replace(/\b\d+\b/g, ' ')
    const words = clean.split(/\s+/).filter(w => w.length > 2)
    return new Set(words)
  }

  // 3. Similarity test
  const isSimilar = (a: string, b: string): boolean => {
    const stemA = getStem(a)
    const stemB = getStem(b)

    // Stems match or one contains the other (if stem length >= 8)
    if (stemA.length >= 8 && stemB.length >= 8) {
      if (stemA === stemB || stemA.includes(stemB) || stemB.includes(stemA)) {
        return true
      }
    }

    // Token overlap comparison
    const tokensA = getTokens(a)
    const tokensB = getTokens(b)

    if (tokensA.size === 0 || tokensB.size === 0) return false

    let intersection = 0
    tokensA.forEach(t => {
      if (tokensB.has(t)) intersection++
    })

    const minSize = Math.min(tokensA.size, tokensB.size)
    const overlapRatio = intersection / minSize

    return overlapRatio >= 0.65
  }

  // 4. Select best representative text for a group
  const selectBestText = (texts: string[]): string => {
    // Count exact string occurrences
    const freq: Record<string, number> = {}
    for (const t of texts) freq[t] = (freq[t] || 0) + 1

    const maxFreq = Math.max(...Object.values(freq))
    const topCandidates = Array.from(new Set(texts.filter(t => freq[t] === maxFreq)))

    // Clean function to remove trailing bullet noise like "1. (a) common proper..."
    const cleanCandidate = (str: string): string => {
      let s = str.trim()
      // Remove starting/colon asterisks like ": *" -> ": "
      s = s.replace(/:\s*[\*\-\_]+/g, ': ')
      // Remove trailing sub-numberings like " 1. (a) common proper..." if colon prefix exists
      if (s.includes(':')) {
        const parts = s.split(':')
        const prefix = parts[0].trim()
        let rest = parts.slice(1).join(':').trim()
        // Strip trailing sub-bullets in rest if there's noise
        rest = rest.replace(/\s+\d+[\.\)]\s*\([a-z]\).*/gi, '')
        s = `${prefix}: ${rest}`
      } else {
        s = s.replace(/\s+\d+[\.\)]\s*\([a-z]\).*/gi, '')
      }
      return s.trim()
    }

    const cleaned = topCandidates.map(cleanCandidate).filter(Boolean)
    if (cleaned.length > 0) {
      // Return the shortest clean version that has good length (avoiding truncated snippets)
      cleaned.sort((a, b) => a.length - b.length)
      return cleaned[0]
    }

    return topCandidates[0]
  }

  // 5. Grouping loop
  const groups: { items: CompetencyInputItem[]; count: number }[] = []

  for (const item of items) {
    const trimmed = item.text.trim()

    let matchedGroup = groups.find(g =>
      g.items.some(existing => isSimilar(existing.text.trim(), trimmed))
    )

    if (matchedGroup) {
      matchedGroup.items.push(item)
      matchedGroup.count++
    } else {
      groups.push({
        items: [item],
        count: 1,
      })
    }
  }

  // Return grouped competencies sorted by combined frequency count
  return groups
    .map(g => {
      const raw_texts = g.items.map(i => i.text.trim())
      const reported_details: ReportedDetail[] = g.items.map(i => ({
        school_name: i.school_name || 'School Entry',
        teacher_name: i.teacher_name || 'Teacher',
        reference_number: i.reference_number || 'Ref No.',
        exact_text: i.text.trim(),
        submission_id: i.submission_id,
      }))

      return {
        competency_text: selectBestText(raw_texts),
        count: g.count,
        raw_texts,
        reported_details,
      }
    })
    .sort((a, b) => b.count - a.count)
}
