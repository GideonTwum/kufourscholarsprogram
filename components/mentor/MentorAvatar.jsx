/**
 * Mentor photo or initials fallback
 */
export default function MentorAvatar({ mentor, sizeClass = "h-24 w-24 text-3xl", textClass = "text-royal" }) {
  const initial = (mentor?.full_name || "?").charAt(0);
  if (mentor?.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mentor.photo_url}
        alt=""
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-royal/20 to-gold/20 font-bold ${textClass} ${sizeClass}`}
    >
      {initial}
    </div>
  );
}
