/* Prancheta 8-Bit — dados dos clubes e nomes (jogadores são fictícios) */
(function (root) {
  'use strict';
  // [nome, sigla, UF, cor1, cor2, força]
  const CLUBS = [
    [ // Série A
      ['Flamengo', 'FLA', 'RJ', '#c8102e', '#111111', 86], ['Palmeiras', 'PAL', 'SP', '#0b6b3a', '#ffffff', 85],
      ['Cruzeiro', 'CRU', 'MG', '#1e4fb5', '#ffffff', 80], ['Mirassol', 'MIR', 'SP', '#f5d000', '#0b6b3a', 76],
      ['Fluminense', 'FLU', 'RJ', '#7a1f3d', '#0b6b3a', 78], ['Botafogo', 'BOT', 'RJ', '#111111', '#ffffff', 79],
      ['Bahia', 'BAH', 'BA', '#1e6fd9', '#e3262e', 78], ['São Paulo', 'SAO', 'SP', '#ffffff', '#e3262e', 78],
      ['Grêmio', 'GRE', 'RS', '#35a7e0', '#111111', 77], ['Bragantino', 'RBB', 'SP', '#ffffff', '#d2003c', 76],
      ['Atlético-MG', 'CAM', 'MG', '#111111', '#ffffff', 79], ['Santos', 'SAN', 'SP', '#ffffff', '#111111', 75],
      ['Corinthians', 'COR', 'SP', '#ffffff', '#111111', 79], ['Vasco', 'VAS', 'RJ', '#111111', '#ffffff', 76],
      ['Vitória', 'VIT', 'BA', '#e3262e', '#111111', 72], ['Internacional', 'INT', 'RS', '#d81e2c', '#ffffff', 77],
      ['Coritiba', 'CFC', 'PR', '#0b6b3a', '#ffffff', 71], ['Athletico-PR', 'CAP', 'PR', '#c8102e', '#111111', 73],
      ['Chapecoense', 'CHA', 'SC', '#0e8f4a', '#ffffff', 69], ['Remo', 'REM', 'PA', '#14285a', '#ffffff', 69]
    ],
    [ // Série B
      ['Ceará', 'CEA', 'CE', '#111111', '#ffffff', 69], ['Fortaleza', 'FOR', 'CE', '#1e4fb5', '#e3262e', 70],
      ['Juventude', 'JUV', 'RS', '#0b6b3a', '#ffffff', 67], ['Sport', 'SPT', 'PE', '#c8102e', '#111111', 68],
      ['Criciúma', 'CRI', 'SC', '#f5d000', '#111111', 66], ['Goiás', 'GOI', 'GO', '#0b6b3a', '#ffffff', 67],
      ['Novorizontino', 'NOV', 'SP', '#f5d000', '#111111', 66], ['CRB', 'CRB', 'AL', '#e3262e', '#ffffff', 65],
      ['Avaí', 'AVA', 'SC', '#1e6fd9', '#ffffff', 65], ['Cuiabá', 'CUI', 'MT', '#0b6b3a', '#f5d000', 66],
      ['Atlético-GO', 'ACG', 'GO', '#c8102e', '#111111', 66], ['Operário-PR', 'OPE', 'PR', '#111111', '#ffffff', 64],
      ['Vila Nova', 'VIL', 'GO', '#d81e2c', '#ffffff', 64], ['América-MG', 'AMG', 'MG', '#0e8f4a', '#111111', 66],
      ['Athletic-MG', 'ATH', 'MG', '#111111', '#ffffff', 62], ['Botafogo-SP', 'BSP', 'SP', '#e3262e', '#111111', 62],
      ['Ponte Preta', 'PON', 'SP', '#111111', '#ffffff', 62], ['Londrina', 'LON', 'PR', '#35a7e0', '#ffffff', 61],
      ['Náutico', 'NAU', 'PE', '#e3262e', '#ffffff', 62], ['São Bernardo', 'SBE', 'SP', '#f5d000', '#111111', 61]
    ],
    [ // Série C
      ['Ferroviária', 'FER', 'SP', '#7a1f3d', '#ffffff', 59], ['Amazonas', 'AMA', 'AM', '#f5d000', '#111111', 59],
      ['Volta Redonda', 'VOL', 'RJ', '#f5d000', '#111111', 58], ['Paysandu', 'PAY', 'PA', '#35a7e0', '#ffffff', 60],
      ['Guarani', 'GUA', 'SP', '#0b6b3a', '#ffffff', 58], ['Brusque', 'BRU', 'SC', '#f5d000', '#e3262e', 56],
      ['Caxias', 'CAX', 'RS', '#7a1f3d', '#35a7e0', 56], ['Ypiranga', 'YPI', 'RS', '#f5d000', '#0b6b3a', 55],
      ['Floresta', 'FLO', 'CE', '#0b6b3a', '#ffffff', 53], ['Confiança', 'CON', 'SE', '#1e4fb5', '#ffffff', 55],
      ['Figueirense', 'FIG', 'SC', '#111111', '#ffffff', 56], ['Ituano', 'ITU', 'SP', '#e3262e', '#111111', 57],
      ['Botafogo-PB', 'BPB', 'PB', '#111111', '#ffffff', 55], ['Maringá', 'MAR', 'PR', '#111111', '#ffffff', 55],
      ['Anápolis', 'ANA', 'GO', '#e3262e', '#ffffff', 53], ['Itabaiana', 'ITA', 'SE', '#1e4fb5', '#e3262e', 53],
      ['Barra-SC', 'BAR', 'SC', '#f5d000', '#1e4fb5', 53], ['Santa Cruz', 'STA', 'PE', '#e3262e', '#111111', 56],
      ['Inter de Limeira', 'INL', 'SP', '#111111', '#ffffff', 54], ['Maranhão', 'MAC', 'MA', '#1e4fb5', '#e3262e', 52]
    ],
    [ // Série D
      ['Tombense', 'TOM', 'MG', '#e3262e', '#ffffff', 50], ['Retrô', 'RET', 'PE', '#f5d000', '#1e4fb5', 50],
      ['ABC', 'ABC', 'RN', '#111111', '#ffffff', 50], ['CSA', 'CSA', 'AL', '#1e4fb5', '#ffffff', 51],
      ['América-RN', 'AMR', 'RN', '#e3262e', '#ffffff', 49], ['Sampaio Corrêa', 'SCO', 'MA', '#f5d000', '#0b6b3a', 49],
      ['Treze', 'TRE', 'PB', '#111111', '#ffffff', 46], ['Portuguesa', 'POR', 'SP', '#d81e2c', '#0b6b3a', 48],
      ['Joinville', 'JOI', 'SC', '#111111', '#e3262e', 48], ['Brasil de Pelotas', 'BRP', 'RS', '#e3262e', '#111111', 46],
      ['Cascavel', 'CAS', 'PR', '#f5d000', '#111111', 46], ['Manaus', 'MAN', 'AM', '#0b6b3a', '#ffffff', 47],
      ['Altos', 'ALT', 'PI', '#0b6b3a', '#f5d000', 45], ['Ferroviário', 'FRV', 'CE', '#e3262e', '#111111', 46],
      ['Aparecidense', 'APA', 'GO', '#1e6fd9', '#ffffff', 46], ['Água Santa', 'AGS', 'SP', '#1e4fb5', '#ffffff', 47],
      ['Nova Iguaçu', 'NIG', 'RJ', '#ff7a00', '#111111', 46], ['Luverdense', 'LUV', 'MT', '#0b6b3a', '#ffffff', 44],
      ['Ceilândia', 'CEI', 'DF', '#111111', '#ffffff', 45], ['ASA', 'ASA', 'AL', '#111111', '#ffffff', 45]
    ]
  ];
  const NICK = ('Juninho Tiquinho Pedrinho Luizinho Dudu Biro Zeca Pipoca Marreta Canhoto Tico Neco Bolinha Paulista Baiano ' +
    'Gaúcho Mineiro Carioca Ceará Goiano Capixaba Xodó Fumaça Jacaré Tatu Pantera Leão Formiga Grilo Pitbull Foguete ' +
    'Chicão Tonhão Marcão Robertão Zezão Betinho Serginho Marquinhos Toninho Nando Cadu Guga Léo Rafa Tuca Vavá Zito ' +
    'Dinho Careca Peixe Maestro Ligeirinho Cabeção Tanque Bigode Faísca Trovão Kiko Nenê Lulinha Buiú Pezão Mosquito').split(' ');
  const FIRST = ('João Pedro Lucas Mateus Gabriel Rafael Bruno Felipe Thiago Diego André Carlos Eduardo Fábio Gustavo ' +
    'Henrique Igor Jorge Leandro Marcelo Murilo Natan Otávio Paulo Renan Rodrigo Samuel Vítor Wesley Yuri Caio Danilo ' +
    'Emerson Everton Fernando Gilberto Hugo Ícaro Jean Kauã Luan Matheus Nilton Patrick Ramon Sandro Tales Wagner Alan').split(' ');
  const LAST = ('Silva Santos Oliveira Souza Lima Pereira Costa Ferreira Almeida Ribeiro Carvalho Gomes Martins Rocha ' +
    'Barbosa Araújo Melo Cardoso Teixeira Moreira Nunes Vieira Monteiro Mendes Freitas Barros Pinto Correia Dias Castro ' +
    'Campos Moraes Ramos Rezende Batista Farias Peixoto Andrade Macedo Tavares Borges Sales Paiva Queiroz Xavier Leite').split(' ');
  const DATA = { CLUBS, NICK, FIRST, LAST };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  root.PB_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
