export const PAYOUT_PLUGIN_OPTIONS = Symbol('PAYOUT_PLUGIN_OPTIONS');
export const loggerCtx = 'PayoutPlugin';

export const ACH_CODES: Record<string, string> = {
  // Códigos legacy, mapper para sellers
  '001': '1007',   // Bancolombia
  '051': '1051',   // Davivienda
  '013': '1013',   // BBVA
  '002': '1002',   // Banco Popular
  '003': '1001',   // Banco de Bogotá
  '507': '1507',   // Nequi
  // Nuevos sellers: guardan el código de 4 dígitos directo (passthrough en service)
};

// Catálogo oficial del generador PAB de Bancolombia (libro "CODIGOS DE BANCOS")
export const BANKS: Record<string, string> = {
  // Legacy (3 dígitos) — sellers ya registrados
  '001': 'Bancolombia',
  '051': 'Banco Davivienda',
  '013': 'BBVA Colombia',
  '002': 'Banco Popular',
  '003': 'Banco de Bogotá',
  '507': 'Nequi',
  // Oficiales de 4 dígitos
  '1001': 'Banco de Bogotá',
  '1002': 'Banco Popular',
  '1006': 'Itaú (antes Corpbanca)',
  '1007': 'Bancolombia',
  '1009': 'Citibank',
  '1012': 'Banco GNB Sudameris',
  '1013': 'BBVA Colombia',
  '1014': 'Itaú',
  '1019': 'Davibank',
  '1023': 'Banco de Occidente',
  '1031': 'Bancoldex',
  '1032': 'Banco Caja Social',
  '1040': 'Banco Agrario',
  '1047': 'Banco Mundo Mujer',
  '1051': 'Banco Davivienda',
  '1052': 'Banco AV Villas',
  '1053': 'Banco W',
  '1059': 'Bancamía',
  '1060': 'Banco Pichincha',
  '1061': 'Bancoomeva',
  '1062': 'Banco Falabella',
  '1063': 'Banco Finandina',
  '1065': 'Banco Santander',
  '1066': 'Banco Coopcentral',
  '1067': 'MiBanco',
  '1069': 'Banco Serfinanza',
  '1070': 'Lulo Bank',
  '1071': 'Banco JP Morgan',
  '1086': 'Asopagos',
  '1121': 'Financiera Juriscoop',
  '1283': 'Cooperativa Financiera de Antioquia',
  '1286': 'JFK Cooperativa Financiera',
  '1289': 'Cootrafa Cooperativa Financiera',
  '1292': 'Confiar Cooperativa Financiera',
  '1303': 'Banco Unión',
  '1370': 'Coltefinanciera',
  '1507': 'Nequi',
  '1551': 'Daviplata',
  '1558': 'Ban100',
  '1560': 'Pibank',
  '1637': 'Iris',
  '1801': 'Movii',
  '1802': 'Ding (Tecnipagos)',
  '1803': 'Powwi',
  '1804': 'Ualá',
  '1805': 'Banco BTG Pactual',
  '1808': 'Bold',
  '1809': 'Nu',
  '1811': 'RappiPay',
  '1812': 'Coink',
  '1814': 'Global66',
  '1816': 'Crezcamos',
  '1819': 'Banco Contactar',
  '1829': 'Addi',
  '1899': 'Aval Soluciones Digitales',
};

// Bancos donde la cuenta ES el celular (Nequi, Daviplata): el accountNumber se usa también en el campo "celular" del detalle
export const PHONE_BANKS = ['1507', '1551'];

export const TRANSACTION_TYPE: Record<string, string> = {
  AHORROS: '37',
  CORRIENTE: '27',
};

export const COMPANY_ACCOUNT_TYPE_CODE: Record<string, string> = {
  AHORROS: 'S',
  CORRIENTE: 'D',
};

export const PAYMENT_TYPE = '238';
export const APPLICATION_CODE = 'I';
export const RECORD_CONTROL = '1';
export const RECORD_DETAIL = '6';
export const LINE_BREAK = '\r\n';

export const PAB = {
  VALUE_ENTERO: 15,
  VALUE_DECIMAL: 2,
  VALUE_TOTAL: 17,
  CTRL_NIT: 15,
  CTRL_APLICACION: 1,
  CTRL_FILLER1: 15,
  CTRL_CLASE: 3,
  CTRL_DESCRIPCION: 10,
  CTRL_FECHA: 8,
  CTRL_SECUENCIA: 2,
  CTRL_REGISTROS: 6,
  CTRL_DEBITOS: 17,
  CTRL_CREDITOS: 17,
  CTRL_CUENTA: 11,
  CTRL_TIPO_CTA: 1,
  CTRL_FILLER2: 149,
  DET_NIT: 15,
  DET_NOMBRE: 30,
  DET_BANCO: 9,
  DET_CUENTA: 17,
  DET_LUGAR_PAGO: 1,
  DET_TIPO_TX: 2,
  DET_VALOR: 17,
  DET_FECHA: 8,
  DET_REF: 21,
  DET_TIPO_DOC: 1,
  DET_OFICINA: 5,
  DET_CELULAR: 15,
  DET_EMAIL: 80,
  DET_AUTORIZADO: 15,
  DET_FILLER: 27,
};

export const DOC_TYPE_MAP: Record<string, string> = {
  CC: '1',
  'C.C.': '1',
  'Cédula de Ciudadanía': '1',
  CE: '2',
  'C.E.': '2',
  'Cédula de Extranjería': '2',
  NIT: '3',
  TI: '4',
  'Tarjeta de Identidad': '4',
  PP: '5',
  Pasaporte: '5',
};
