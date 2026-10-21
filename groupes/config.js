/**
 * Groupes Atrium. A later subdomain only needs canonicalOrigin
 * (and, if the files move to the subdomain root, no path change:
 * links are resolved from this folder).
 *
 * jsonUrl is the live catalog served by reservation-api.
 * On localhost, or with ?fixture=1, the pages use data/groupes.json.
 */
window.GROUPES_CONFIG = {
  jsonUrl: 'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/groupes.json',
  reservationApiUrl: 'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/',
  canonicalOrigin: 'https://aubaineexpress.voyagefiesta.ca',
  pageSize: 12,
  phoneDisplay: '514-856-6614',
  phoneHref: 'tel:+15148566614',
  email: 'info@voyagesfiesta.com',
  address: '2001, boul. Robert-Bourassa, bureau 1700, Montréal (QC) H3A 2A6'
};
