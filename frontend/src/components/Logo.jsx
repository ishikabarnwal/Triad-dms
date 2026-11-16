/** The Triad logo on a white tile, so its dark lettering stays readable on plum backgrounds. */
export default function Logo({ large = false }) {
  return (
    <span className={`logo-tile ${large ? "logo-tile-lg" : ""}`}>
      <img src="/logo.png" alt="Triad AI" />
    </span>
  );
}
