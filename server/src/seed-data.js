// Datos iniciales: equipos clasificados, planteles, fechas y cruces de los
// playoffs del Torneo Clausura 2026. Todo es editable luego desde el panel admin.
// Formato de jugador: "Nombre|POS|precio" (precio en millones, ficticio).

export const TEAMS = [
  { id: 'INS', name: 'Instituto', c1: '#d7141a', c2: '#ffffff' },
  { id: 'HUR', name: 'Huracán', c1: '#ffffff', c2: '#e2001a' },
  { id: 'BOC', name: 'Boca Juniors', c1: '#0b3d91', c2: '#f7c600' },
  { id: 'IRM', name: 'Ind. Rivadavia', c1: '#1f4fa3', c2: '#ffffff' },
  { id: 'VEL', name: 'Vélez', c1: '#ffffff', c2: '#1b3f94' },
  { id: 'BEL', name: 'Belgrano', c1: '#6cc4ee', c2: '#0b2b4c' },
  { id: 'RIV', name: 'River Plate', c1: '#ffffff', c2: '#e2001a' },
  { id: 'LAN', name: 'Lanús', c1: '#7a1431', c2: '#ffffff' },
  { id: 'ARG', name: 'Argentinos Jrs.', c1: '#e2001a', c2: '#ffffff' },
  { id: 'IND', name: 'Independiente', c1: '#c8102e', c2: '#ffffff' },
  { id: 'DYJ', name: 'Defensa y Justicia', c1: '#1e8a3c', c2: '#f7d117' },
  { id: 'BAR', name: 'Barracas Central', c1: '#c8102e', c2: '#ffffff' },
  { id: 'CEN', name: 'Rosario Central', c1: '#0b3d91', c2: '#f7c600' },
  { id: 'GEM', name: 'Gimnasia (Mza.)', c1: '#ffffff', c2: '#111111' },
  { id: 'GLP', name: 'Gimnasia (LP)', c1: '#ffffff', c2: '#0b2b5c' },
  { id: 'NOB', name: "Newell's", c1: '#c8102e', c2: '#111111' },
];

export const SQUADS = {
  BOC: `Álvaro Montero|ARQ|7;Leandro Brey|ARQ|3;Lautaro Blanco|DEF|7;Lautaro Di Lollo|DEF|7;Facundo Herrera|DEF|5;Leandro Lozano|DEF|5;Ayrton Costa|DEF|6;Marcelo Weigandt|DEF|4;Santiago Ascacíbar|VOL|8;Milton Delgado|VOL|6;Leandro Paredes|VOL|11;Leonel Flores|VOL|5;Tomás Belmonte|VOL|4;Tomás Aranda|VOL|4;Alan Velasco|DEL|7;Miguel Merentiel|DEL|10;Enner Valencia|DEL|9;Villa|DEL|6;Exequiel Zeballos|DEL|7;Milton Giménez|DEL|6`,
  RIV: `Santiago Beltrán|ARQ|6;Ezequiel Centurión|ARQ|2;Marcos Acuña|DEF|7;Giovanni González|DEF|5;Nicolás Otamendi|DEF|8;Lautaro Rivero|DEF|6;Gonzalo Montiel|DEF|7;Lucas Martínez Quarta|DEF|7;Francisco Ortega|DEF|4;Facundo González|DEF|3;Valentín Lucero|DEF|2;Tobías Ramírez Cardozo|DEF|2;Thiago Almada|VOL|12;Tobías Andrada|VOL|4;Santiago Espíndola|VOL|3;Tomás Galván|VOL|6;Aníbal Moreno|VOL|7;Mauro Arambarri|VOL|4;Lautaro Pereyra|VOL|3;Lucas Silva|VOL|3;Fausto Vera|VOL|5;Lucas Beltrán|DEL|10;Ángel Correa|DEL|10;Rafael Santos Borré|DEL|8;Sebastián Driussi|DEL|7;Facundo Colidio|DEL|6`,
  INS: `Marcos Ledesma|ARQ|6;Fernando Alarcón|DEF|5;Giuliano Cerato|DEF|4;Jonathan Galván|DEF|5;Leonel Mosevich|DEF|5;Diego Sosa|DEF|4;Emanuel Sittaro|DEF|2;Agustín Bravo|DEF|3;Gustavo Abregú|VOL|5;Matías Gallardo|VOL|5;Jeremías Lázaro|VOL|5;Alex Luna|VOL|7;Jhon Córdoba|DEL|6;Matías Fonseca|DEL|4;Nicolás Guerra|DEL|4;Facundo Suárez|DEL|5;Franco Jara|DEL|6;Luca Klimowicz|DEL|4;Manuel Romero|DEL|2`,
  HUR: `Hernán Galíndez|ARQ|6;Sebastián Meza|ARQ|2;César Ibáñez|DEF|4;Hugo Nervo|DEF|4;Máximo Palazzo|DEF|3;Federico Vera|DEF|3;Ignacio Campo|DEF|2;Leandro Lescano|DEF|4;Fabrizio Martínez|DEF|2;Lucas Blondel|VOL|4;Oscar Cortés|VOL|5;Facundo Kalinger|VOL|3;Facundo Waller|VOL|4;Rodrigo Fernández Cedrés|VOL|4;Leonardo Gil|VOL|4;Emmanuel Ojeda|VOL|4;Óscar Romero|VOL|5;Bruno Barticciotto|DEL|5;Jordy Caicedo|DEL|6;Juan Bisanz|DEL|4;Thaiel Peralta|DEL|2;Ignacio Pussetto|DEL|5;Tomás Uribe|DEL|2`,
  VEL: `Tomás Marchiori|ARQ|6;Facundo Sanguinetti|ARQ|2;Joaquín García|DEF|5;Elías Gómez|DEF|5;Lisandro Magallán|DEF|5;Thiago Silvero|DEF|4;Leo Cristaldo|DEF|2;Simón Escobar|DEF|2;Jano Gordon|DEF|4;Claudio Baeza|VOL|5;Manuel Lanzini|VOL|7;Matías Pellegrini|VOL|6;Lucas Robertone|VOL|6;Rodrigo Aliendro|VOL|5;Diego Valdés|VOL|6;Luca Feler|VOL|2;Thiago Villalba|VOL|2;Thiago Aguirre|VOL|2;Ronaldo Martínez|DEL|7;Juan Cruz Policella|DEL|3;Matías Arias|DEL|2;Dilan Godoy|DEL|4;Álex Verón|DEL|3`,
  LAN: `Nahuel Losada|ARQ|6;Franco Petroli|ARQ|2;Tomás Guidara|DEF|4;Carlos Izquierdoz|DEF|5;Ronaldo Dejesús|DEF|4;Sasha Marcich|DEF|5;José Canale|DEF|5;Nicolás Morgantini|DEF|3;Gonzalo Pérez|DEF|3;Tomás López|DEF|2;Luciano Romero|DEF|2;Raúl Loaiza|VOL|4;Felipe Peña Biafore|VOL|4;Agustín Cardozo|VOL|5;Agustín Medina|VOL|5;Marcelino Moreno|VOL|8;Matías Sepúlveda|VOL|4;Franco Watson|VOL|4;Ramiro Carrera|VOL|5;Gonzalo Lobos|VOL|2;Thiago Laplace|VOL|2;Facundo Sánchez|VOL|2;Eduardo Salvio|DEL|7;Lucas Besozzi|DEL|5;Allan Wlk|DEL|4;Dylan Aquino|DEL|4;Benjamín Acosta|DEL|3`,
  BEL: `Thiago Cardozo|ARQ|6;Manuel Vicentini|ARQ|3;Lisandro López|DEF|5;Alexis Maldonado|DEF|4;Leonardo Morales|DEF|5;Adrián Spörle|DEF|4;Alcides Benítez|DEF|3;Álvaro Ocampo|DEF|3;Ramiro Hernandes|VOL|3;Adrián Sánchez|VOL|4;Franco Vázquez|VOL|7;Lucas Zelarayán|VOL|9;Santiago Longo|VOL|4;Francisco González Metilli|VOL|5;Emiliano Rigoni|DEL|6;Lucas Passerini|DEL|7;Nicolás Fernández|DEL|5`,
  IRM: `Nicolás Bolcato|ARQ|5;Emmanuel Gómez Riga|ARQ|2;Ezequiel Bonifacio|DEF|4;Leonard Costa|DEF|4;Juan Manuel Elordi|DEF|4;Luciano Gómez|DEF|4;Sheyko Studer|DEF|5;Alejo Osella|DEF|3;Alex Vigo|DEF|4;Iván Villalba|DEF|4;Diego Crego|DEF|2;Tomás Bottari|VOL|4;Matías Fernández|VOL|6;José Florentín|VOL|4;Gonzalo Ríos|VOL|4;Luis Sequeira|VOL|4;Leonel Bucca|VOL|3;Stéfano Moreyra|VOL|2;Rodrigo Atencio|VOL|3;Alex Arce|DEL|7;Fabrizio Sartori|DEL|6;Matías Reali|DEL|5;Victorio Ramis|DEL|4;Luis Díaz|DEL|2`,
  ARG: `Brayan Cortés|ARQ|6;Gonzalo Siri Payer|ARQ|2;Erik Godoy|DEF|5;Mateo Mendoza|DEF|2;Franco Paredes|DEF|3;Sebastián Prieto|DEF|5;Francisco Álvarez|DEF|5;Kevin Coronel|DEF|4;Claudio Bravo|DEF|4;Facundo Carrizo|VOL|3;Kevin Gutiérrez|VOL|3;Nicolás Oroz|VOL|6;Diego Porcel|VOL|5;Alan Lescano|VOL|7;Hernán López Muñoz|VOL|8;Gino Infantino|VOL|5;Matías Giménez|DEL|5;Gastón Verón|DEL|5`,
  IND: `Santiago Mele|ARQ|5;Rodrigo Rey|ARQ|5;Santiago Arias|DEF|5;Juan Arrayago|DEF|3;Nahuel Banegas|DEF|3;Sebastián Valdez|DEF|5;Franco Calderón|DEF|3;Juan Manuel Fedorco|DEF|3;Leonardo Godoy|DEF|4;Facundo Zabala|DEF|4;Iván Marcone|VOL|5;Maximiliano Meza|VOL|6;Mateo Pérez Curci|VOL|3;Luciano Cabral|VOL|6;Facundo Cruz|VOL|2;Lautaro Millán|VOL|5;Tomás Parmo|VOL|2;Chimy Ávila|DEL|8;Imanol Machuca|DEL|5;Josías Palais|DEL|3;Matías Abaldo|DEL|6;Iván Morales|DEL|4;Felipe Tempone|DEL|3`,
  DYJ: `Matías Borgogno|ARQ|5;Lautaro Amadé|ARQ|2;Demián Domínguez|DEF|3;David Martínez|DEF|5;Valentín Loza|DEF|3;Nazareno Roselli|DEF|3;Ezequiel Burdin|DEF|2;Ayrton Portillo|DEF|4;Fernando Román Villalba|DEF|3;Lucas Souto|DEF|4;David Barbona|VOL|5;Juan Manuel Gutiérrez|VOL|4;Jeremías Lucco|VOL|3;César Pérez|VOL|4;Domingo Blanco|VOL|4;Aarón Molinas|VOL|6;Nicolás Palavecino|VOL|4;Santiago Sosa Yung|DEL|4;Leandro Fernández|DEL|6;Maximiliano Porcel|DEL|3`,
  BAR: `Juan Espínola|ARQ|5;Marcelo Miño|ARQ|3;Rafael Barrios|DEF|4;Nicolás Capraro|DEF|4;Nicolás Demartini|DEF|4;Rodrigo Insúa|DEF|4;Gastón Campi|DEF|3;Damián Martínez|DEF|3;Elías Pereyra|DEF|3;Yonatthan Rak|DEF|4;Rodrigo Bogarín|VOL|4;Dardo Miloc|VOL|4;Iván Tapia|VOL|6;Iván Guaraz|VOL|2;Tomás Lavezzi|VOL|2;Esteban Rolón|VOL|3;Nicolás Orsini|DEL|5;Tomás Porra|DEL|4;Norberto Briasco|DEL|4;Facundo Bruera|DEL|6;Jhonatan Candia|DEL|5;Wilfredo Rivera|DEL|3;Valentino Gandin|DEL|2`,
  CEN: `Jeremías Ledesma|ARQ|6;Jorge Broun|ARQ|3;Gastón Ávila|DEF|5;Emanuel Coronel|DEF|4;Ignacio Ovando|DEF|4;Agustín Sández|DEF|5;Franco Ibarra|VOL|5;Vicente Pizarro|VOL|6;Alan Rodríguez|VOL|3;Ángel Di María|VOL|12;Giovanni Cantizano|VOL|3;Julián Fernández|VOL|4;Franco Cervi|VOL|4;Jaminton Campaz|DEL|8;Enzo Copetti|DEL|6;Alejo Véliz|DEL|7;Marco Ruben|DEL|4;Tomás Badaloni|DEL|4`,
  GEM: `César Rigamonti|ARQ|4;Lautaro Petruchi|ARQ|3;Diego Mondino|DEF|4;Germán Guiffrey|DEF|4;Luciano Paredes|DEF|3;Ezequiel Muñoz|DEF|4;Franco Saavedra|DEF|3;Esteban Fernández|VOL|4;Nahuel Barboza|VOL|3;Ignacio Sabatini|VOL|3;Ulises Sánchez|VOL|3;Facundo Lencioni|VOL|4;Franco Carrera|VOL|3;Fermín Antonini|VOL|3;Agustín Módica|DEL|5;Luciano Cingolani|DEL|3;Valentino Simoni|DEL|4`,
  GLP: `Harlen Castillo|ARQ|5;Nelson Insfrán|ARQ|4;Germán Conti|DEF|4;Enzo Martínez|DEF|4;Pedro Silva Torrejón|DEF|4;Alexis Steimbach|DEF|3;Bautista Barros Schelotto|DEF|3;Juan Cruz Cortazzo|DEF|2;Renzo Giampaoli|DEF|4;Matías Melluso|DEF|3;Ignacio Fernández|VOL|7;Lucas Janson|VOL|5;Ignacio Miramón|VOL|5;Mateo Seoane|VOL|3;Agustín Colazo|VOL|2;Pablo Aguiar|VOL|2;Nicolás Barros Schelotto|VOL|4;Augusto Max|VOL|4;Maximiliano Zalazar|VOL|3;Manuel Panaro|DEL|4;Franco Torres|DEL|4;Marcelo Torres|DEL|6`,
  NOB: `Josué Reinatti|ARQ|4;Gabriel Arias|ARQ|5;Franco Escobar|DEF|4;Lautaro Giannetti|DEF|5;Nicolás Goitea|DEF|3;Jerónimo Russo|DEF|3;Bruno Cabrera|DEF|3;Ian Glavinovich|DEF|4;Martín Luciano|DEF|3;Facundo Guch|VOL|3;Walter Mazzantti|VOL|5;Luca Regiardo|VOL|4;Lautaro Ríos|VOL|2;David Sotelo|VOL|4;Valentino Acuña|VOL|4;Blas Benedetto|VOL|2;Marcelo Esponda|VOL|3;Mateo García|VOL|2;Jerónimo Gómez Mattar|VOL|3;Alan Soñora|VOL|5;Matías Cóccaro|DEL|7;Juan Ignacio Ramírez|DEL|5;Francisco Scarpeccio|DEL|3`,
};

// lock_at = inicio del primer partido de la fecha (hora de Argentina).
// Cuartos, semis y final: horarios estimados, ajustar desde el panel admin.
export const ROUNDS = [
  { id: 1, name: 'Octavos de final', lock_at: '2026-11-20T20:00:00-03:00' },
  { id: 2, name: 'Cuartos de final', lock_at: '2026-11-28T17:00:00-03:00' },
  { id: 3, name: 'Semifinales', lock_at: '2026-12-05T17:00:00-03:00' },
  { id: 4, name: 'Final', lock_at: '2026-12-12T17:00:00-03:00' },
];

export const MATCHES = [
  { round_id: 1, home: 'VEL', away: 'BEL', kickoff: '2026-11-20T20:00:00-03:00' },
  { round_id: 1, home: 'DYJ', away: 'BAR', kickoff: '2026-11-21T17:00:00-03:00' },
  { round_id: 1, home: 'ARG', away: 'IND', kickoff: '2026-11-21T20:00:00-03:00' },
  { round_id: 1, home: 'CEN', away: 'GEM', kickoff: '2026-11-22T16:00:00-03:00' },
  { round_id: 1, home: 'RIV', away: 'LAN', kickoff: '2026-11-22T19:00:00-03:00' },
  { round_id: 1, home: 'INS', away: 'HUR', kickoff: '2026-11-22T22:00:00-03:00' },
  { round_id: 1, home: 'GLP', away: 'NOB', kickoff: '2026-11-23T17:00:00-03:00' },
  { round_id: 1, home: 'BOC', away: 'IRM', kickoff: '2026-11-25T21:00:00-03:00' },
];

export const SETTINGS = {
  budget: 70,               // presupuesto en millones (ficticio)
  max_per_club: 3,          // máximo de jugadores del mismo club
  pin_changes: 4,           // cambios que habilita cada PIN
  pin_price: 2000,          // precio sugerido del PIN en pesos
  pin_buy_info: '',         // cómo comprar (alias, link de pago, WhatsApp...)
  free_changes_per_round: 0,// cambios gratis por fecha (además de los PIN)
  mp_in_app: 0,             // 1 = mostrar el botón de Mercado Pago también dentro de la app Android
  prize_round: 100000,      // premio al ganador de cada fecha
  prize_tournament: 1000000,// premio al ganador del torneo
};
