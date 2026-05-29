export default function Header({ subtitulo }) {
  return (
    <header className="header">
      <img src="/logo-orven.png" alt="Orven" className="header-logo" />
      {subtitulo && <p className="header-sub">{subtitulo}</p>}
    </header>
  );
}
