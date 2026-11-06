# Iframes Aubaines Express

Collez un bloc sur voyagefiesta.com. L'iframe grandit toute seule grâce au message `voyage-fiesta-resize`. Ajoutez `ref` et `ghl_user` à l'adresse quand le visiteur vient d'un conseiller. Le lien d'un groupe reste `https://aubaineexpress.voyagefiesta.ca/groupes/groupe/?id=<id>&slug=<slug>`.

Le script parent est le même pour chaque bloc. Changez seulement `id` et `src`.

```html
<script>
window.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data.type !== 'voyage-fiesta-resize' || !data.height) return;
  var frames = document.querySelectorAll('iframe[data-vf-embed]');
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].contentWindow === event.source) frames[i].style.height = data.height + 'px';
  }
});
</script>
```

`data-vf-path` rappelle la page affichée. Le message met à jour seulement l'iframe qui l'a envoyé, donc plusieurs blocs peuvent cohabiter.

## Site principal, pour voyagefiesta.com

Montre les bandes (Sud, croisières, voyages, équipe) sans l'en-tête du site Aubaines Express.

```html
<iframe
  title="Aubaines Express"
  data-vf-embed
  data-vf-path="/"
  src="https://aubaineexpress.voyagefiesta.ca/embed/"
  style="width:100%;border:0;min-height:720px"
  loading="lazy"></iframe>
```

## Aubaines

Liste des forfaits seulement.

```html
<iframe
  title="Aubaines Express"
  data-vf-embed
  data-vf-path="/"
  src="https://aubaineexpress.voyagefiesta.ca/embed/aubaines/"
  style="width:100%;border:0;min-height:720px"
  loading="lazy"></iframe>
```

## Forfaits SUD

```html
<iframe
  title="Forfaits SUD"
  data-vf-embed
  data-vf-path="/groupes/forfaits-sud/"
  src="https://aubaineexpress.voyagefiesta.ca/embed/sud/"
  style="width:100%;border:0;min-height:720px"
  loading="lazy"></iframe>
```

## Croisières

```html
<iframe
  title="Croisières"
  data-vf-embed
  data-vf-path="/groupes/croisieres/"
  src="https://aubaineexpress.voyagefiesta.ca/embed/croisieres/"
  style="width:100%;border:0;min-height:720px"
  loading="lazy"></iframe>
```

## Voyages

```html
<iframe
  title="Voyages"
  data-vf-embed
  data-vf-path="/groupes/voyages/"
  src="https://aubaineexpress.voyagefiesta.ca/embed/voyages/"
  style="width:100%;border:0;min-height:720px"
  loading="lazy"></iframe>
```

## Mariage

```html
<iframe
  title="Mariage"
  data-vf-embed
  data-vf-path="/groupes/mariages/"
  src="https://aubaineexpress.voyagefiesta.ca/embed/mariages/"
  style="width:100%;border:0;min-height:480px"
  loading="lazy"></iframe>
```

## Page conseiller

Même collage que les autres blocs : la classe `vf-plein-auto` et le message `voyage-fiesta-resize`. La page conseiller masque son en-tête et son pied seulement dans une iframe, et la hauteur suit le contenu (elle peut aussi diminuer). En visite directe, l'en-tête et le pied restent visibles.

`ref`, `ghl_user` et les paramètres `utm_` ajoutés à l'adresse suivent les liens internes.

```html
<style>
.vf-plein{width:100%;max-width:100%;margin:0 auto;}
.vf-plein iframe{display:block;width:100%;height:1600px;border:0;background:#fff;}
</style>
<div class="vf-plein vf-plein-conseiller">
  <iframe class="vf-plein-auto" src="https://aubaineexpress.voyagefiesta.ca/agents/eric-lacasse/" title="Voyage Fiesta : Ton conseiller Eric Lacasse" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
</div>
<script>
(function(){
  if(window.vfPleinePage)return;window.vfPleinePage=true;
  window.addEventListener('message',function(e){
    if(e.origin!=='https://aubaineexpress.voyagefiesta.ca')return;
    var d=e.data;
    if(!d||d.type!=='voyage-fiesta-resize'||typeof d.height!=='number'||d.height<200)return;
    var f=document.querySelectorAll('iframe.vf-plein-auto');
    for(var i=0;i<f.length;i++){
      if(f[i].contentWindow!==e.source)continue;
      f[i].style.height=Math.min(d.height,40000)+'px';
      if(d.path&&f[i].getAttribute('data-vf-page')&&f[i].getAttribute('data-vf-page')!==d.path){
        var r=f[i].getBoundingClientRect();
        if(r.top<0)window.scrollBy(0,r.top-20);
      }
      if(d.path)f[i].setAttribute('data-vf-page',d.path);
    }
  });
})();
</script>
```

Pour un autre conseiller, remplacez seulement le `src` par `https://aubaineexpress.voyagefiesta.ca/agents/<slug>/`.

## Conseiller

Ajoutez la query sur le `src`, par exemple :

`https://aubaineexpress.voyagefiesta.ca/embed/sud/?ref=eric-lacasse&ghl_user=ID_GHL`

`ref`, `ghl_user` et les paramètres `utm_` suivent les liens internes, y compris `/groupes/groupe/?id=<id>&slug=<slug>`.
