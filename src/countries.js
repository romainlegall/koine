'use strict';

/**
 * Liste de pays en français, pour le jeu des pays.
 *
 * Format : [nom de référence, ...variantes acceptées].
 *
 * Le nom de référence est celui qu'on attend en premier. Les variantes couvrent
 * les formes couramment dites à l'oral : « les Etats-Unis » pour « États-Unis »,
 * « le Congo » pour « République démocratique du Congo », etc.
 *
 * L'indexation se fait sur la première lettre de chaque forme acceptée, après
 * retrait des accents : Égypte et Egypte comptent donc pour la lettre E.
 */

const PAYS = [
  ['Afghanistan'],
  ['Afrique du Sud', 'RSA'],
  ['Albanie', 'Albanie du Nord'],
  ['Algérie'],
  ['Allemagne'],
  ['Andorre'],
  ['Angola'],
  ['Antigua-et-Barbuda', 'Antigua et Barbuda', 'Antigua'],
  ['Argentine'],
  ['Arménie'],
  ['Australie'],
  ['Autriche'],
  ['Azerbaïdjan', 'Azerbaidjan'],
  ['Bahamas', 'La Bahamas'],
  ['Bahreïn', 'Bahrein'],
  ['Bangladesh', 'Bengladesh'],
  ['Barbade', 'La Barbade'],
  ['Belgique', 'La Belgique'],
  ['Belize', 'Le Belize'],
  ['Bénin', 'Benin'],
  ['Bhoutan', 'Bhutan'],
  ['Biélorussie', 'Bielorussie', 'Biélarus'],
  ['Bolivie'],
  ['Bosnie-Herzégovine', 'Bosnie Herzegovine', 'Bosnie'],
  ['Botswana'],
  ['Brésil', 'Brasil'],
  ['Brunei'],
  ['Bulgarie'],
  ['Burkina Faso'],
  ['Burundi'],
  ['Cambodge', 'Le Cambodge'],
  ['Cameroun', 'Le Cameroun'],
  ['Canada', 'Le Canada'],
  ['Cap-Vert', 'Cape Vert'],
  ['Chili', 'Le Chili'],
  ['Chine', 'La Chine'],
  ['Chypre', 'Chypre'],
  ['Colombie', 'La Colombie'],
  ['Comores', 'Les Comores'],
  ['Congo', 'Congo Brazzaville', 'République du Congo'],
  [
    'République démocratique du Congo',
    'RD Congo',
    'Congo Kinshasa',
    'Congo leopoldville',
    'Zaïre',
    'Zaire',
  ],
  ['Corée du Nord', 'Coree du Nord', 'Nord-Coree'],
  ['Corée du Sud', 'Coree du Sud', 'Sud-Coree'],
  ['Costa Rica'],
  ['Côte d\'Ivoire', 'Cote d Ivoire', 'Cote divoire'],
  ['Croatie'],
  ['Cuba', 'La Cuba'],
  ['Danemark', 'Le Danemark'],
  ['Djibouti'],
  ['Dominique', 'La Dominique'],
  ['Egypte', 'Égypte'],
  ['Émirats arabes unis', 'Emirats arabes unis', 'Émirats arabes unis', 'Emirats'],
  ['Équateur', 'Equateur'],
  ['Érythrée', 'Erythee'],
  ['Espagne', 'L Espagne'],
  ['Estonie', 'L Estonie'],
  ['États-Unis', 'Etats-Unis', 'Etats Unis', 'États Unis', 'Les Etats-Unis', 'Etats-Unis'],
  ['Éthiopie', 'Ethiopie'],
  ['Fidji', 'Fiji'],
  ['Finlande', 'La Finlande'],
  ['France'],
  ['Gabon', 'Le Gabon'],
  ['Gambie', 'La Gambie'],
  ['Géorgie', 'Georgie'],
  ['Ghana'],
  ['Grèce', 'La Grece'],
  ['Grenade', 'La Grenade'],
  ['Guatemala', 'Le Guatemala'],
  ['Guinée', 'Guinee', 'Guinée de Conakry'],
  ['Guinée-Bissau', 'Guinee-Bissau', 'Guinée Bissau'],
  ['Guinée équatoriale', 'Guinee equatoriale'],
  ['Guyana', 'Le Guyana'],
  ['Haïti', 'Haiti'],
  ['Honduras', 'Le Honduras'],
  ['Hongrie', 'La Hongrie'],
  ['Îles Marshall', 'Iles Marshall', 'Marshall'],
  ['Îles Salomon', 'Iles Salomon', 'Salomon'],
  ['Inde', 'L Inde'],
  ['Indonésie', 'Indonesie'],
  ['Irak'],
  ['Iran'],
  ['Irlande', 'L Irlande'],
  ['Islande', 'L Islande'],
  ['Israël', 'Israel'],
  ['Italie', 'L Italie'],
  ['Jamaïque', 'Jamaique'],
  ['Japon', 'Le Japon'],
  ['Jordanie', 'La Jordanie'],
  ['Kazakhstan', 'Kazakstan'],
  ['Kenya', 'Le Kenya'],
  ['Kirghizistan', 'Kirghizie'],
  ['Kiribati'],
  ['Koweït', 'Koweit'],
  ['Laos'],
  ['Lesotho'],
  ['Lettonie'],
  ['Liban', 'Le Liban'],
  ['Libéria', 'Liberia'],
  ['Libye'],
  ['Liechtenstein'],
  ['Lituanie'],
  ['Luxembourg', 'Le Luxembourg'],
  ['Macédoine du Nord', 'Macedoine du Nord', 'Macédoine', 'Macedoine'],
  ['Madagascar'],
  ['Malawi'],
  ['Malaisie', 'Malaisie'],
  ['Maldives'],
  ['Mali', 'Le Mali'],
  ['Malte'],
  ['Maroc', 'Le Maroc'],
  ['Maurice', 'Ile Maurice', 'Île Maurice'],
  ['Mauritanie', 'La Mauritanie'],
  ['Mexique', 'Le Mexique'],
  ['Micronésie', 'Micronesie'],
  ['Moldavie'],
  ['Monaco', 'La principauté de Monaco'],
  ['Mongolie', 'La Mongolie'],
  ['Monténégro', 'Montenegro'],
  ['Mozambique', 'Le Mozambique'],
  ['Namibie', 'La Namibie'],
  ['Nauru'],
  ['Népal', 'Nepal'],
  ['Nicaragua'],
  ['Niger', 'Le Niger'],
  ['Nigeria', 'Nigéria'],
  ['Norvège', 'La Norvege'],
  ['Nouvelle-Zélande', 'Nouvelle Zeelande', 'Nouvelle Zelande'],
  ['Oman', 'Oman'],
  ['Ouzbékistan', 'Ouzbekistan'],
  ['Pakistan'],
  ['Palaos', 'Palau'],
  ['Palestine'],
  ['Panama', 'Le Panama'],
  ['Papouasie-Nouvelle-Guinée', 'Papouasie Nouvelle Guinee', 'Papouasie'],
  ['Paraguay'],
  ['Pays-Bas', 'Pays Bas', 'Neerland'],
  ['Pérou', 'Perou'],
  ['Philippines', 'Les Philippines'],
  ['Pologne', 'La Pologne'],
  ['Portugal'],
  ['Qatar', 'Le Qatar'],
  [
    'République centrafricaine',
    'Centrafrique',
    'République centrafricaine',
  ],
  ['République dominicaine', 'Dominicaine', 'Saint-Domingue'],
  ['République tchèque', 'Tchéquie', 'Tchequie', 'République tcheque'],
  ['Roumanie'],
  ['Royaume-Uni', 'Royaume Uni', 'Grande-Bretagne', 'Angleterre', 'Royaume-Uni'],
  ['Russie', 'La Russie', 'Fédération de Russie'],
  ['Rwanda'],
  ['Saint-Christophe-et-Niévès', 'Saint Christophe et Nieves', 'Saint-Kitts'],
  ['Saint-Marin', 'Saint Marin'],
  ['Saint-Vincent-et-les-Grenadines', 'Saint Vincent et Grenadines'],
  ['Sainte-Lucie', 'Sainte Lucie'],
  ['Salvador', 'Le Salvador'],
  ['Samoa'],
  ['Sao Tomé-et-Principe', 'São Tomé et Principe'],
  ['Sénégal', 'Senegal'],
  ['Serbie'],
  ['Seychelles'],
  ['Sierra Leone'],
  ['Singapour', 'Le Singapour'],
  ['Slovaquie'],
  ['Slovénie', 'Slovenie'],
  ['Somalie', 'La Somalie'],
  ['Soudan du Sud'],
  ['Soudan', 'Le Soudan'],
  ['Sri Lanka', 'Ceylan'],
  ['Suède', 'La Suede'],
  ['Suisse', 'La Suisse'],
  ['Suriname'],
  ['Tadjikistan', 'Tadjikistan'],
  ['Tanzanie', 'La Tanzanie'],
  ['Tchad', 'Le Tchad'],
  ['Thaïlande', 'Thailande'],
  ['Timor oriental', 'Timor Orientale'],
  ['Togo'],
  ['Tonga'],
  ['Trinité-et-Tobago', 'Trinite et Tobago'],
  ['Tunisie', 'La Tunisie'],
  ['Turkménistan', 'Turkmenistan'],
  ['Turquie', 'La Turquie'],
  ['Tuvalu'],
  ['Ukraine', 'L Ukraine'],
  ['Uruguay', 'L Uruguay'],
  ['Vanuatu'],
  ['Vatican', 'Saint-Siège'],
  ['Venezuela', 'Le Venezuela'],
  ['Viêt Nam', 'Vietnam', 'Viet Nam'],
  ['Yémen', 'Le Yemen'],
  ['Zambie'],
  ['Zimbabwe'],
];

/** Formes acceptées, une par pays. */
const FORME = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

/**
 * index : forme normalisée -> { canonique, lettre }
 * lettrage : lettre -> [pays]
 */
const index = new Map();
const lettrage = new Map();

for (const [canonique, ...variantes] of PAYS) {
  for (const forme of [canonique, ...variantes]) {
    index.set(FORME(forme), { canonique, lettre: FORME(forme).charAt(0) });
  }
  const lettre = FORME(canonique).charAt(0);
  if (!lettrage.has(lettre)) lettrage.set(lettre, []);
  lettrage.get(lettre).push(canonique);
}

/** Lettres jouables : celles qui ont au moins un pays. */
const LETTRES = [...lettrage.keys()].sort();

/** Les lettres les moins fournies : un pays y rend la manche très dure. */
const LETTRES_RARES = new Set(['j', 'k', 'q', 'v', 'x', 'z']);

function trouver(nom) {
  return index.get(FORME(nom)) || null;
}

/** Tous les pays commençant par une lettre. */
function paysPour(lettre) {
  return lettrage.get(FORME(lettre)) || [];
}

/**
 * Le pays le plus proche d'une saisie : sert à proposer une correction quand
 * quelqu'un se trompe de lettre.
 * @returns {{canonique: string, distance: number}|null}
 */
function plusProche(nom, lettre) {
  const cible = FORME(nom);
  if (!cible) return null;
  let meilleur = null;
  for (const [forme, meta] of index) {
    // uniquement les pays de la bonne lettre : proposer un autre pays
    // n'aide pas à comprendre l'erreur
    if (meta.lettre !== FORME(lettre)) continue;
    const d = distance(cible, forme);
    if (d <= 2 && (!meilleur || d < meilleur.distance)) meilleur = { canonique: meta.canonique, distance: d };
  }
  return meilleur;
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

module.exports = { PAYS, LETTRES, LETTRES_RARES, FORME, trouver, paysPour, plusProche };