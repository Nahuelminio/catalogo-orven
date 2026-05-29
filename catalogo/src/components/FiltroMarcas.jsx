export default function FiltroMarcas({ marcas, marcaActiva, onChange, secundario }) {
  return (
    <div className={`filtro-marcas ${secundario ? "filtro-secundario" : ""}`}>
      {marcas.map((marca) => (
        <button
          key={marca}
          className={`filtro-btn ${secundario ? "filtro-btn-sm" : ""} ${marcaActiva === marca ? "activo" : ""}`}
          onClick={() => onChange(marca)}
        >
          {marca}
        </button>
      ))}
    </div>
  );
}
