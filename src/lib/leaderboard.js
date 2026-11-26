export function rankCompletedParticipants(entries) {
  const completedEntries = entries
    .filter((entry) => entry.status === 'terminé')
    .sort((first, second) => (
      second.score - first.score ||
      first.elapsedMs - second.elapsedMs ||
      first.username.localeCompare(second.username)
    ));

  let rank = 0;
  return completedEntries.map((entry, index) => {
    const previous = completedEntries[index - 1];
    if (!previous || previous.score !== entry.score || previous.elapsedMs !== entry.elapsedMs) {
      rank = index + 1;
    }
    return { ...entry, rank };
  });
}
