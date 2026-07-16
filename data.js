// Datos iniciales de simulación para MAGIC
const initialMachines = [
  {
    id: "M0001",
    name: "Inyectora de Plástico A",
    location: "Alta Gracia",
    status: "operativa",
    lastMaintenance: "2026-06-15",
    image: "images/injection_molder.png"
  },
  {
    id: "M0002",
    name: "Torno CNC Haas",
    location: "Mina Clavero",
    status: "mantenimiento",
    lastMaintenance: "2026-07-10",
    image: "images/cnc_milling.png"
  },
  {
    id: "M0003",
    name: "Brazo Robótico KUKA",
    location: "Terminal T2",
    status: "parada",
    lastMaintenance: "2026-05-20",
    image: "images/robotic_arm.png"
  },
  {
    id: "M0004",
    name: "Prensa Hidráulica 50T",
    location: "Villa María",
    status: "operativa",
    lastMaintenance: "2026-04-10",
    image: "images/hydraulic_press.png"
  }
];

const initialOrders = [
  {
    id: "WO-1001",
    machineId: "M0001",
    title: "Calibración de Sensores de Temperatura",
    description: "Revisión y calibración de las termocuplas en las zonas de calefacción del cañón de inyección.",
    type: "preventivo", // preventivo, correctivo
    priority: "media", // alta, media, baja
    status: "en-progreso", // pendiente, en-progreso, completado
    createdAt: "2026-07-12",
    notes: "Se detectó desviación de 2°C en la zona 3 de calefacción. Se procede a re-calibrar."
  },
  {
    id: "WO-1002",
    machineId: "M0003",
    title: "Fuga hidráulica en manguera principal",
    description: "Reemplazar la manguera de alta presión en el circuito hidráulico principal. Se observó goteo de aceite.",
    type: "correctivo",
    priority: "alta",
    status: "pendiente",
    createdAt: "2026-07-13",
    notes: ""
  },
  {
    id: "WO-1003",
    machineId: "M0002",
    title: "Limpieza y engrase de guías lineales",
    description: "Mantenimiento rutinario mensual para asegurar precisión en los desplazamientos de los ejes X, Y, Z.",
    type: "preventivo",
    priority: "baja",
    status: "completado",
    createdAt: "2026-07-10",
    notes: "Mantenimiento exitoso. Se verificó el movimiento suave y libre de fricción en todos los ejes."
  }
];

// Exportación para su uso en app.js (en navegador)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initialMachines, initialOrders };
}
