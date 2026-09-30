// Sustituto mínimo de react-native para cargar módulos de tema/gráficos en Node (scripts de exportación).
module.exports = {
  Platform: { OS: 'web', select: (options) => options.web ?? options.default },
};
