/**
 * The Triad logo. On plum it sits on a white tile so its dark lettering stays readable;
 * `bare` drops the tile for white backgrounds.
 */
export default function Logo({ large = false, bare = false }) {
  return (
    <span className={`logo-tile ${large ? "logo-tile-lg" : ""} ${bare ? "bare" : ""}`}>
      <img src="/logo.png" alt="Triad AI" />
    </span>
  );
}
