# Generate voyages-import.csv from migration-preview.json (no Node required)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$previewPath = Join-Path $root 'imports\migration-preview.json'
$productsPath = Join-Path $root 'products.json'
$outImport = Join-Path $root 'imports\voyages-import.csv'
$outPhotos = Join-Path $root 'imports\voyages-photos.csv'

function Escape-Csv([string]$s) {
  if ($null -eq $s) { return '' }
  $s = [string]$s
  if ($s -match '[",`n`r]') { return '"' + ($s -replace '"', '""') + '"' }
  return $s
}

function Format-Money($v) {
  if ($null -eq $v -or $v -eq '') { return '' }
  $n = [double]([string]$v -replace '\s|\$', '' -replace ',', '.')
  if ([double]::IsNaN($n)) { return '' }
  return [string]([math]::Round($n, 2))
}

function Format-Date($v) {
  if ($null -eq $v -or $v -eq '') { return '' }
  try { return ([datetime]$v).ToString('yyyy-MM-dd') } catch { return [string]$v }
}

function Normalize-Statut($v) {
  $s = ([string]$v).ToLower().Trim()
  if ($s -in @('complet_sold_out','complet','inactif','brouillon','archiv')) { return 'inactif' }
  return 'actif'
}

function Normalize-Aeroport($v) {
  $s = ([string]$v).ToLower()
  if ($s -match 'montr|yul') { return 'montral_yul' }
  return [string]$v
}

function Normalize-Fournisseur($v) {
  $s = ([string]$v).ToLower()
  if ($s -match 'vacances_air_canada|vacances air canada') { return 'vacances_air_canada' }
  if ($s -match 'sunwing') { return 'sunwing' }
  if ($s -match 'transat') { return 'transat' }
  if ($s -match 'air.canada|air_canada') { return 'air_canada' }
  return [string]$v
}

function Normalize-Transporteur($v) {
  $s = ([string]$v).ToLower()
  if ($s -match 'westjet') { return 'westjet' }
  if ($s -match 'air canada') { return 'air_canada' }
  if ($s -match 'transat') { return 'transat' }
  return ([string]$v).ToLower() -replace '\s+', '_'
}

function Normalize-TypeForfait($v) {
  $s = ([string]$v).ToLower()
  if ($s -match 'tout' -and $s -match 'inclus') { return 'toutinclus' }
  return [string]$v
}

function Format-Criteria($arr) {
  if ($null -eq $arr) { return '' }
  $items = @($arr) | ForEach-Object { [string]$_ } | Where-Object { $_ }
  return ($items -join '|')
}

function Get-Prop($p, [string]$key) {
  if ($p.PSObject.Properties.Name -contains $key) { return $p.$key }
  return $null
}

function Get-PhotoUrls($val) {
  $urls = @()
  if ($null -eq $val) { return $urls }
  foreach ($item in @($val)) {
    if ($item.url) { $urls += $item.url }
  }
  return $urls
}

$preview = Get-Content -Raw -Encoding UTF8 $previewPath | ConvertFrom-Json
$taxMap = @{}
if (Test-Path $productsPath) {
  $products = Get-Content -Raw -Encoding UTF8 $productsPath | ConvertFrom-Json
  foreach ($p in $products.products) {
    if ($p.name -and $null -ne $p.taxesAmount) { $taxMap[$p.name] = $p.taxesAmount }
  }
}

$schemaPath = Join-Path $root 'imports\ghl-schema-target.json'
$labelBySuffix = @{}
if (Test-Path $schemaPath) {
  $schema = Get-Content -Raw -Encoding UTF8 $schemaPath | ConvertFrom-Json
  foreach ($f in $schema.fields) {
    if ($f.key) {
      $suffix = ($f.key -split '\.')[-1]
      $labelBySuffix[$suffix] = $f.label
    }
  }
}

function Label([string]$suffix, [string]$fallback) {
  if ($labelBySuffix.ContainsKey($suffix)) { return $labelBySuffix[$suffix] }
  return $fallback
}

$headers = @(
  (Label 'forfaits' 'forfaits'),
  (Label 'statut' 'Statut'),
  (Label 'inventaire' 'Inventaire'),
  (Label 'destination' 'Destination'),
  (Label 'pays' 'Pays'),
  (Label 'date_de_dpart' 'Date de depart'),
  (Label 'dure_nuits' 'Duree (nuits)'),
  (Label 'fin_promo_top_chrono' 'Fin promo top chrono'),
  (Label 'date_paiement_final' 'Date paiement final'),
  (Label 'aroport_de_dpart' 'Aeroport de depart'),
  (Label 'aroport_de_retour' 'Aeroport de retour'),
  (Label 'etoiles' 'Etoiles'),
  (Label 'catgorie_de_chambre' 'Categorie de chambre'),
  (Label 'type_de_forfait' 'Type de forfait'),
  (Label 'description_hotel' 'Description_Hotel'),
  (Label 'critres' 'criteres'),
  (Label 'fournisseur' 'Fournisseur'),
  (Label 'transporteur' 'Transporteur'),
  (Label 'prix_occ_double' 'Prix occ. double'),
  (Label 'prix_occ_simple' 'Prix occ. simple'),
  (Label 'prix_occ_triple' 'Prix occ. triple'),
  (Label 'prix_occ_quad' 'Prix occ. quad'),
  (Label 'enfant_2_ans_et_moins' 'Enfant 2 ans et moins'),
  (Label '1er_enfant_212_ans' '1er enfant 2-12 ans'),
  (Label '2e_enfant_212_ans' '2e enfant 2-12 ans'),
  (Label '1er_enfant_1317_ans' '1er enfant 13-17 ans'),
  (Label '2e_enfant_1317_ans' '2e enfant 13-17 ans'),
  (Label 'taxes_par_personne' 'Taxes et frais aeriens ($ / pers.)'),
  (Label 'rabais_aubaines_express' 'Rabais Aubaines Express'),
  (Label 'depot_par_personne' 'Depot requis ($ / pers.)'),
  (Label 'vol_aller_numero' 'Vol aller numero'),
  (Label 'vol_aller_heure_dpart' 'Vol aller -heure depart'),
  (Label 'vol_retour_numero' 'Vol retour -numero'),
  (Label 'vol_retour_heure_dpart' 'Vol retour -heure depart'),
  (Label 'lien_fiche_fournisseur' 'Lien fiche fournisseur')
)

$importLines = @(($headers | ForEach-Object { Escape-Csv $_ }) -join ',')
$photoLines = @('name,Photo principale (URL),Photos extra URL 1,Photos extra URL 2,Notes')

foreach ($rec in $preview.records) {
  $p = $rec.properties
  $name = Get-Prop $p 'name'
  $taxes = Get-Prop $p 'taxes_par_personne'
  if (($null -eq $taxes -or $taxes -eq '') -and $taxMap.ContainsKey($name)) {
    $taxes = $taxMap[$name]
  }
  $extra = Get-Prop $p 'photo_extra'
  if (-not $extra) { $extra = Get-Prop $p 'photo_chambre' }

  $row = @(
    $name,
    (Normalize-Statut (Get-Prop $p 'statut')),
    (Get-Prop $p 'inventaire'),
    (Get-Prop $p 'destination'),
    (Get-Prop $p 'pays'),
    (Format-Date (Get-Prop $p 'date_depart')),
    (Get-Prop $p 'duree_nuits'),
    (Format-Date (Get-Prop $p 'date_fin_promo')),
    (Format-Date (Get-Prop $p 'date_paiement_final')),
    (Normalize-Aeroport (Get-Prop $p 'aeroport_depart')),
    (Get-Prop $p 'aeroport_retour'),
    (Get-Prop $p 'etoiles'),
    (Get-Prop $p 'categorie_chambre'),
    (Normalize-TypeForfait (Get-Prop $p 'type_forfait')),
    (Get-Prop $p 'description_hotel'),
    (Format-Criteria (Get-Prop $p 'criteres')),
    (Normalize-Fournisseur (Get-Prop $p 'fournisseur')),
    (Normalize-Transporteur (Get-Prop $p 'transporteur')),
    (Format-Money (Get-Prop $p 'prix_occ_double')),
    (Format-Money (Get-Prop $p 'prix_occ_simple')),
    (Format-Money (Get-Prop $p 'prix_occ_triple')),
    (Format-Money (Get-Prop $p 'prix_occ_quad')),
    (Format-Money (Get-Prop $p 'prix_enfant_2_moins')),
    (Format-Money (Get-Prop $p 'prix_1er_enfant_2_12')),
    (Format-Money (Get-Prop $p 'prix_2e_enfant_2_12')),
    (Format-Money (Get-Prop $p 'prix_1er_enfant_13_17')),
    (Format-Money (Get-Prop $p 'prix_2e_enfant_13_17')),
    (Format-Money $taxes),
    (Format-Money (Get-Prop $p 'rabais')),
    (Format-Money (Get-Prop $p 'depot_par_personne')),
    (Get-Prop $p 'vol_aller_numero'),
    (Get-Prop $p 'vol_aller_heure_depart'),
    (Get-Prop $p 'vol_retour_numero'),
    (Get-Prop $p 'vol_retour_heure_depart'),
    (Get-Prop $p 'lien_fiche_fournisseur')
  )
  $importLines += (($row | ForEach-Object { Escape-Csv $_ }) -join ',')

  $mainUrls = @(Get-PhotoUrls (Get-Prop $p 'photo_principale'))
  $extraUrls = @(Get-PhotoUrls $extra)
  $note = @()
  if ($extraUrls.Count -gt 1) { $note += 'GHL Photos extra = 1 fichier max' }
  $photoRow = @(
    (Escape-Csv $name),
    (Escape-Csv ($(if ($mainUrls.Count -gt 0) { $mainUrls[0] } else { '' }))),
    (Escape-Csv ($(if ($extraUrls.Count -gt 0) { $extraUrls[0] } else { '' }))),
    (Escape-Csv ($(if ($extraUrls.Count -gt 1) { $extraUrls[1] } else { '' }))),
    (Escape-Csv ($(if ($note.Count) { $note -join '; ' } else { '' })))
  ) -join ','
  $photoLines += $photoRow
}

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outImport, ($importLines -join "`r`n") + "`r`n", $utf8)
[System.IO.File]::WriteAllText($outPhotos, ($photoLines -join "`r`n") + "`r`n", $utf8)
Write-Host "Wrote $($preview.records.Count) records to:"
Write-Host "  $outImport"
Write-Host "  $outPhotos"
