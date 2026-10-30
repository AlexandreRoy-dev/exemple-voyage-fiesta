import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, plainText, richHtml } from './richtext.mjs';

test('décode jusqu’à stabilité, y compris le double encodage', () => {
  assert.equal(decodeEntities('D&eacute;part'), 'Départ');
  assert.equal(decodeEntities('D&amp;eacute;part &amp;amp;#39;'), "Départ '");
  assert.equal(decodeEntities('l&#39;esprit th&eacute;&acirc;tre &rsquo; &#x2019;'), 'l\'esprit théâtre ’ ’');
  assert.equal(decodeEntities('&inconnu; reste'), '&inconnu; reste');
});

test('plainText retire les balises', () => {
  assert.equal(plainText('<p>Arriv&eacute;e: 09:30 / D&eacute;part: 18:00</p>'), 'Arrivée: 09:30 / Départ: 18:00');
  assert.equal(plainText('&lt;p&gt;Cap Town &amp;gt; Durban&lt;/p&gt;'), 'Cap Town > Durban');
});

test('richHtml garde la liste blanche et assainit', () => {
  assert.equal(richHtml('<p>Le Celebrity Summit refl&egrave;te</p>'), '<p>Le Celebrity Summit reflète</p>');
  assert.equal(richHtml('<p style="color:red" onclick="x()"><strong>Jour 1</strong> &gt; Lima<script>alert(1)</script></p>'), '<p><strong>Jour 1</strong> &gt; Lima</p>');
  assert.equal(richHtml('<a href="javascript:alert(1)">x</a>'), '<a>x</a>');
  assert.equal(richHtml('<a href="https://ex.com/?a=1&amp;b=2">x</a>'), '<a href="https://ex.com/?a=1&amp;b=2" target="_blank" rel="noopener nofollow">x</a>');
  assert.equal(richHtml('<p>a</ol></ul>b'), '<p>ab</p>');
  assert.equal(richHtml('Ligne 1\nLigne 2\n\nPara 2'), '<p>Ligne 1<br>Ligne 2</p><p>Para 2</p>');
  assert.equal(richHtml('<img src=x onerror=alert(1)>Texte'), 'Texte');
  assert.equal(richHtml('&lt;script&gt;alert(1)&lt;/script&gt;ok'), '<p>ok</p>');
});
