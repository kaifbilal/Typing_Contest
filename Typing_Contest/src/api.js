const SNIPPETS = [
  {
    id: 'stoic-lines',
    title: 'Meditations',
    difficulty: 'easy',
    addedLabel: 'Added 6 days ago',
    source: 'Public Domain',
    words: ['The', 'soul', 'becomes', 'dyed', 'with', 'the', 'color', 'of', 'its', 'thoughts,', 'so', 'choose', 'your', 'words', 'as', 'if', 'they', 'shape', 'your', 'world.'],
  },
  {
    id: 'odyssey',
    title: 'The Odyssey',
    difficulty: 'hard',
    addedLabel: 'Added 5 years ago',
    source: 'Classic Epic',
    words: ['These', 'nights', 'are', 'endless,', 'and', 'a', 'man', 'can', 'sleep', 'through', 'them,', 'or', 'he', 'can', 'enjoy', 'listening', 'to', 'stories,', 'and', 'you', 'have', 'no', 'need', 'to', 'go', 'to', 'bed', 'before', 'it', 'is', 'time.'],
  },
  {
    id: 'good-will-hunting',
    title: 'Good Will Hunting',
    difficulty: 'easy',
    addedLabel: 'Added 5 years ago',
    source: 'Movie Dialogue',
    words: ["I've", 'got', 'to', 'get', 'up', 'in', 'the', 'morning', 'and', 'spend', 'some', 'more', 'money', 'on', 'my', 'overpriced', 'education.'],
  },
  {
    id: 'interstellar',
    title: 'Interstellar',
    difficulty: 'medium',
    addedLabel: 'Added 11 months ago',
    source: 'Movie Dialogue',
    words: ['Love', 'is', 'the', 'one', 'thing', 'we', 'are', 'capable', 'of', 'perceiving', 'that', 'transcends', 'dimensions', 'of', 'time', 'and', 'space.'],
  },
]

const HOME_HISCORES = {
  daily: [
    { rank: 1, name: 'doodles', accuracy: 100, wpm: 223.2, difficulty: 'easy', when: '9 hours ago' },
    { rank: 2, name: 'Philleth', accuracy: 98, wpm: 180.36, difficulty: 'medium', when: '2 hours ago' },
    { rank: 3, name: 'wendigo', accuracy: 100, wpm: 175.25, difficulty: 'medium', when: '23 hours ago' },
  ],
  weekly: [
    { rank: 1, name: 'Arctetical', accuracy: 93, wpm: 152.24, difficulty: 'easy', when: '8 hours ago' },
    { rank: 2, name: 'Stel', accuracy: 100, wpm: 148.24, difficulty: 'easy', when: '2 hours ago' },
    { rank: 3, name: 'snoo', accuracy: 97, wpm: 147.17, difficulty: 'hard', when: '8 hours ago' },
  ],
  monthly: [
    { rank: 1, name: 'Halokankaku', accuracy: 89, wpm: 146.84, difficulty: 'easy', when: '3 hours ago' },
    { rank: 2, name: 'some yapper lol', accuracy: 99, wpm: 146.48, difficulty: 'medium', when: '1 day ago' },
    { rank: 3, name: 'reminiscent-85', accuracy: 100, wpm: 146.46, difficulty: 'easy', when: '9 hours ago' },
  ],
}

const SNIPPET_HISCORES = [
  { name: 'Sedahades', wpm: 188.65, when: '1 year ago' },
  { name: 'dannysaur', wpm: 162.41, when: '3 years ago' },
  { name: 'Googas', wpm: 155.4, when: '2 years ago' },
  { name: 'Trey', wpm: 149.48, when: '1 year ago' },
  { name: 'doodles', wpm: 146.44, when: '2 weeks ago' },
]

const LOBBY_PLAYERS = [
  { id: 'u-1', name: 'Mohd Kaif', emoji: '🤞', color: '#993500' },
  { id: 'u-2', name: 'Arctetical', emoji: '👽', color: '#355c7d' },
  { id: 'u-3', name: 'wendigo', emoji: '👾', color: '#5f4b8b' },
]

function withDelay(payload, delay = 120) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(payload), delay)
  })
}

export async function fetchSnippets() {
  return withDelay(SNIPPETS)
}

export async function fetchHomeHiscores() {
  return withDelay(HOME_HISCORES)
}

export async function fetchSnippetHiscores() {
  return withDelay(SNIPPET_HISCORES)
}

export async function fetchLobbyPlayers() {
  return withDelay(LOBBY_PLAYERS)
}
