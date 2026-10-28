const FreePaper = (() => {
  function metadata(html, url) {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const values = names => [...doc.querySelectorAll('meta')].filter(m=>names.includes((m.getAttribute('name')||m.getAttribute('property')||'').toLowerCase())).map(m=>m.content.trim()).filter(Boolean);
    const id = Ref.ids(values(['citation_doi','prism.doi','dc.identifier']).join(' '));
    let pdf='';try{const raw=values(['citation_pdf_url'])[0];if(raw){const u=new URL(raw,url);if(/^https?:$/.test(u.protocol))pdf=u.href;}}catch{}
    return {doi:id.doi,title:values(['citation_title','dc.title','og:title'])[0]||'',authors:values(['citation_author','dc.creator']),pdf};
  }
  async function find(url, meta = {}, hint = '') {
    const u = new URL(url);
    if(!/^https?:$/.test(u.protocol))return null;
    if(/(^|\.)arxiv\.org$/i.test(u.hostname))return null;
    const fromUrl=Ref.ids(url).doi,doi=fromUrl||meta.doi||hint;
    if(fromUrl&&meta.doi&&fromUrl.toLowerCase()!==meta.doi.toLowerCase())throw new Error('The publisher page and URL identify different articles');
    const source=doi?'https://doi.org/'+doi:meta.title&&meta.authors?.length?meta.authors.join(', ')+'. '+meta.title+'.':'';
    if(!source)throw new Error('No reliable article identifier was available');
    const record=await Ref.resolve(source);
    if(record.status!=='verified')throw new Error('The article identity could not be confirmed');
    if(meta.title && !Ref.sameTitle(meta.title,record.title))throw new Error('Publisher metadata does not match the identified article');
    const arxiv=await Ref.arxivOf(record);
    if(!arxiv)throw new Error('No verified arXiv version was found');
    return {url:'https://arxiv.org/pdf/'+arxiv,arxiv,record,origin:url};
  }
  return {metadata,find};
})();
if(typeof module!=='undefined')module.exports=FreePaper;
