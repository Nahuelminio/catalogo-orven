import { useState, useCallback } from "react";

export function useToast() {
  const [estado, setEstado] = useState({ mensaje: "", tipo: "ok" });

  const mostrar = useCallback((mensaje, tipo = "ok") => {
    setEstado({ mensaje, tipo });
  }, []);

  const cerrar = useCallback(() => {
    setEstado({ mensaje: "", tipo: "ok" });
  }, []);

  return { toast: estado, mostrar, cerrar };
}
