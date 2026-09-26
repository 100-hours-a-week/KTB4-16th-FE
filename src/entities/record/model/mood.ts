/** Record moodScore를 화면용 표정으로 변환하는 공통 정책이다. */
export function getMoodEmoji(score: number): string {
  if (score <= -41) return '😭';
  if (score <= -31) return '😢';
  if (score <= -21) return '😣';
  if (score <= -11) return '😞';
  if (score <= -1) return '🙁';
  if (score <= 10) return '😐';
  if (score <= 20) return '🙂';
  if (score <= 30) return '😊';
  if (score <= 40) return '😄';
  return '🤩';
}
