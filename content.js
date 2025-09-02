    // ---- Config (can override via localStorage) ----
    const GLOBALS = globalThis.CMS_CONFIG ?? {};
    const config = globalThis.CONFIG || {};
    const DEFAULT_FUNCTIONS_URL = config.DEFAULT_FUNCTIONS_URL || GLOBALS.api?.baseUrl || 'https://eamewialuovzguldcdcf.functions.supabase.co';
    const WRITE_SECRET = "Misterbignose12!";
    const VIEW_PASSWORD = "Misterbignose12!";

    const checkoutUrls = GLOBALS.checkoutUrls ?? { web: "/checkout" };
    globalThis.checkoutUrls = checkoutUrls;
    const canDelete = !!GLOBALS.api?.del;

    function getFnsUrl(){ return localStorage.getItem('cmsFunctionsUrl') || DEFAULT_FUNCTIONS_URL; }
    function setFnsUrl(u){ if(u) localStorage.setItem('cmsFunctionsUrl', u); }
    function getAnon(){ return localStorage.getItem('cmsAnon') || ''; }
    function setAnon(k){ if(k) localStorage.setItem('cmsAnon', k); }
    function clearAuth(){ localStorage.removeItem('ruminateAuth'); }

    const DAYS_SIMPLE = [
      { key: 'mon', label: 'Monday' },
      { key: 'tue', label: 'Tuesday' },
      { key: 'wed', label: 'Wednesday' },
      { key: 'thu', label: 'Thursday' },
      { key: 'sat', label: 'Saturday' },
      { key: 'sun', label: 'Sunday' },
    ];

    function $id(id){ return document.getElementById(id); }
    function showError(msg){ const e=$id('err'); e.textContent=String(msg||''); e.style.display = msg ? 'block' : 'none'; }
    function showStatus(msg, ms=2000){
      const s = $id('status');
      if(!s) return;
      s.textContent = String(msg || '');
      if(msg){
        s.classList.add('show');
        clearTimeout(showStatus._t);
        showStatus._t = setTimeout(()=>{ s.classList.remove('show'); s.textContent=''; }, ms);
      }else{
        s.classList.remove('show');
      }
    }

    // ---- Gate handling ----
    function openEditor(){
      $id('gate').style.display='none';
      $id('editor').style.display='block';
    }
    function checkPassword(pw, remember){
      if(pw === VIEW_PASSWORD){
        if(remember) localStorage.setItem('ruminateAuth','true');
        openEditor();
        return true;
      }
      showError('Incorrect page password.');
      return false;
    }
    if(localStorage.getItem('ruminateAuth')==='true'){ openEditor(); }

    // ---- API (shared with everything) ----
    async function apiGetAll(){
      showError('');
      const anon = getAnon();
      if(!anon) throw new Error('Supabase Anon key not set (click “Set Supabase anon key”).');
      const res = await fetch(`${getFnsUrl()}/cms-get`, {
        headers:{
          'Authorization': `Bearer ${anon}`,
          'apikey': anon
        }
      });
      if(!res.ok) throw new Error(`GET failed: ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      try{
        if(!ct.includes('application/json')) throw new Error();
        return await res.json();
      }catch(err){
        throw new Error('Unexpected response format');
      }
    }
    async function apiUpsert(key, value){
      showError('');
      const anon = getAnon();
      if(!anon) throw new Error('Supabase Anon key not set (click “Set Supabase anon key”).');
      const res = await fetch(`${getFnsUrl()}/cms-set`, {
        method:'POST',
        headers:{
          'Authorization': `Bearer ${anon}`,
          'apikey': anon,
          'content-type':'application/json',
          'x-cms-secret': WRITE_SECRET
        },
        body: JSON.stringify({ key, value })
      });
      const out = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(out.error || `Save failed (${res.status})`);
      return out;
    }
    async function apiDelete(key){
      showError('');
      if(!canDelete) return; // endpoint not configured
      const anon = getAnon();
      if(!anon) throw new Error('Supabase Anon key not set (click “Set Supabase anon key”).');
      if(!key) return; // short-circuit
      key = key.trim().replace(/\/$/, '');
      let res;
      const url = `${GLOBALS.api.del}?key=${encodeURIComponent(key)}`;
      try {
        res = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anon,
            'Authorization': `Bearer ${anon}`,
            'x-client-info': 'cms-ui'
          }
        });
      } catch (err) {
        throw new Error('Network or CORS error while deleting key.');
      }
      if (!(res.ok || res.status === 204)) {
        const text = await res.text().catch(() => '');
        showError(text);
        throw new Error(`cms-del failed ${res.status}: ${text}`);
      }
    }

    // ---- Hours UI ----
    function hoursKey(dayKey, kind){ return `hours.${dayKey}.${kind}`; }

    function renderHours(map){
      const rows = $id('hoursRows'); rows.innerHTML='';
      DAYS_SIMPLE.forEach(({key,label})=>{
        const openVal = map[hoursKey(key,'open')] || '';
        const closeVal = map[hoursKey(key,'close')] || '';
        const row = document.createElement('div'); row.className='hoursRow'; row.dataset.day=key; row.dataset.type='simple';

        const lab = document.createElement('label'); lab.textContent = label; row.appendChild(lab);

        const openInp = document.createElement('input'); openInp.type='text'; openInp.placeholder='e.g. 08:00'; openInp.value=openVal; openInp.dataset.kind='open'; row.appendChild(openInp);
        const closeInp = document.createElement('input'); closeInp.type='text'; closeInp.placeholder='e.g. 17:00'; closeInp.value=closeVal; closeInp.dataset.kind='close'; row.appendChild(closeInp);

        const saveBtn = document.createElement('button'); saveBtn.textContent='Save';
        saveBtn.onclick = async ()=>{ try{
          await apiUpsert(hoursKey(key,'open'), openInp.value);
          await apiUpsert(hoursKey(key,'close'), closeInp.value);
          showStatus(`${label} saved`);
        }catch(e){ showError(e.message||'Save failed'); } };
        row.appendChild(saveBtn);

        rows.appendChild(row);
      });

      const fri = document.createElement('div'); fri.className='hoursRow'; fri.dataset.day='fri'; fri.dataset.type='split';
      const friLab = document.createElement('label'); friLab.textContent = "Friday (Jumu\u2019ah)"; fri.appendChild(friLab);

      const fOpen1 = document.createElement('input'); fOpen1.type='text'; fOpen1.placeholder='Open 1 (e.g. 08:00)'; fOpen1.value = map[hoursKey('fri','open1')] || ''; fOpen1.dataset.kind='open1'; fri.appendChild(fOpen1);
      const fClose1 = document.createElement('input'); fClose1.type='text'; fClose1.placeholder='Close 1 (e.g. 12:00)'; fClose1.value = map[hoursKey('fri','close1')] || ''; fClose1.dataset.kind='close1'; fri.appendChild(fClose1);
      const fOpen2 = document.createElement('input'); fOpen2.type='text'; fOpen2.placeholder='Open 2 (e.g. 14:00)'; fOpen2.value = map[hoursKey('fri','open2')] || ''; fOpen2.dataset.kind='open2'; fri.appendChild(fOpen2);
      const fClose2 = document.createElement('input'); fClose2.type='text'; fClose2.placeholder='Close 2 (e.g. 18:00)'; fClose2.value = map[hoursKey('fri','close2')] || ''; fClose2.dataset.kind='close2'; fri.appendChild(fClose2);

      const friSave = document.createElement('button'); friSave.textContent='Save';
      friSave.onclick = async ()=>{ try{
        await apiUpsert(hoursKey('fri','open1'), fOpen1.value);
        await apiUpsert(hoursKey('fri','close1'), fClose1.value);
        await apiUpsert(hoursKey('fri','open2'), fOpen2.value);
        await apiUpsert(hoursKey('fri','close2'), fClose2.value);
        showStatus('Friday saved');
      }catch(e){ showError(e.message||'Save failed'); } };
      fri.appendChild(friSave);

      rows.appendChild(fri);
    }

    // ---- Generic key/value list (with Remove) ----
    function renderList(map){
      const list = $id('list'); list.innerHTML='';
      const keys = Object.keys(map||{}).filter(k => map[k] !== '').sort();
      if(!keys.length){ list.innerHTML = '<div>No entries yet.</div>'; return; }
      keys.forEach(k=>{
        const row = document.createElement('div'); row.className='row';
        const lab = document.createElement('label'); lab.textContent=k; row.appendChild(lab);
        const inp = document.createElement('input'); inp.type='text'; inp.value=map[k]||''; row.appendChild(inp);

        const saveBtn = document.createElement('button'); saveBtn.textContent='Save';
        saveBtn.onclick = async ()=>{ try{ inp.value ? await apiUpsert(k, inp.value) : await apiDelete(k); showStatus('Saved'); }catch(e){ showError(e.message||'Save failed'); } };
        row.appendChild(saveBtn);

        const rmBtn = document.createElement('button'); rmBtn.textContent='Remove';
        if (!canDelete) {
          rmBtn.disabled = true;
        } else {
          rmBtn.onclick = async () => {
            const prevText = rmBtn.textContent;
            rmBtn.disabled = true; rmBtn.textContent = 'Removing...';
            try {
              await apiDelete(k);
              row.remove();
              showStatus('Removed');
            } catch (e) {
              showError(e.message || 'Remove failed');
              rmBtn.disabled = false; rmBtn.textContent = prevText;
              return;
            }
            try {
              await loadAll();
            } catch (e) {
              showError(e.message || 'Refresh failed');
            }
          };
        }
        row.appendChild(rmBtn);

        list.appendChild(row);
      });
    }

    // ---- Menu UI ----
    function readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Creates a new row with inputs + four option checkboxes
    function addMenuRow(data = {}) {
      const tbody = document.getElementById('menuRows');
      if (!tbody) return;
      const tr = document.createElement('tr');

      // suffix
      const suffixTd = document.createElement('td');
      const suffixInput = document.createElement('input');
      suffixInput.type = 'text';
      suffixInput.placeholder = 'e.g. latte';
      suffixInput.value = data.suffix || '';
      suffixTd.appendChild(suffixInput);
      tr.appendChild(suffixTd);

      // name
      const nameTd = document.createElement('td');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'e.g. Latte';
      nameInput.value = data.name || '';
      nameTd.appendChild(nameInput);
      tr.appendChild(nameTd);

      // price
      const priceTd = document.createElement('td');
      const priceInput = document.createElement('input');
      priceInput.type = 'number';
      priceInput.min = '0';
      priceInput.step = '0.01';
      priceInput.placeholder = '0.00';
      priceInput.value = data.price || '';
      priceTd.appendChild(priceInput);
      tr.appendChild(priceTd);

      // desc
      const descTd = document.createElement('td');
      const descInput = document.createElement('input');
      descInput.type = 'text';
      descInput.placeholder = 'Description';
      descInput.value = data.desc || '';
      descTd.appendChild(descInput);
      tr.appendChild(descTd);

      // category radios (coffee / not-coffee / pif / specials)
      const catTd = document.createElement('td');
      const groupName = `cat-${Date.now()}-${Math.random()}`;
      function mkRadio(val, labelText) {
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = groupName;
        input.value = val;
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.marginRight = '8px';
        return [input, label];
      }
      const [catCoffee, lblCoffee]       = mkRadio('coffee', 'Coffee');
      const [catNotCoffee, lblNotCoffee] = mkRadio('not-coffee', 'Not Coffee');
      const [catPif, lblPif]             = mkRadio('pif', 'Pay it forward');
      const [catSpecials, lblSpecials]   = mkRadio('specials', 'Specials');

      if (data.category === 'coffee')      catCoffee.checked = true;
      if (data.category === 'not-coffee')  catNotCoffee.checked = true;
      if (data.category === 'pif')         catPif.checked = true;
      if (data.category === 'specials')    catSpecials.checked = true;

      [catCoffee, lblCoffee, catNotCoffee, lblNotCoffee, catPif, lblPif, catSpecials, lblSpecials]
        .forEach(el => catTd.appendChild(el));
      tr.appendChild(catTd);

      // drink / not drink radios
      const typeTd = document.createElement('td');
      const typeGroup = `type-${Date.now()}-${Math.random()}`;
      function mkType(val, labelText) {
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = typeGroup;
        input.value = val;
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.marginRight = '8px';
        return [input, label];
      }
      const [typeDrink, lblDrink]     = mkType('drink', 'Drink');
      const [typeNot, lblNot]         = mkType('', 'Not Drink');
      if (data.type === 'drink') typeDrink.checked = true; else typeNot.checked = true;
      [typeDrink, lblDrink, typeNot, lblNot].forEach(el => typeTd.appendChild(el));
      tr.appendChild(typeTd);

      // Options checkboxes (Alt / Syrups / Extra / Coffee blend)
      const optsTd = document.createElement('td');
      function mkCheck(id, labelText, checked=false) {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '6px';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = id; cb.checked = !!checked;
        const lb = document.createElement('label'); lb.textContent = labelText;
        wrap.appendChild(cb); wrap.appendChild(lb);
        return { wrap, cb };
      }
      const cAlt     = mkCheck('opt-alt',   'Alt milks',   !!data.optAlt);
      const cSyrups  = mkCheck('opt-syrup', 'Syrups',      !!data.optSyrups);
      const cExtra   = mkCheck('opt-extra', 'Extra shot',  !!data.optExtra);
      const cCoffee  = mkCheck('opt-cof',   'Coffee blend',!!data.optCoffee);
      [cAlt.wrap, cSyrups.wrap, cExtra.wrap, cCoffee.wrap].forEach(x => optsTd.appendChild(x));
      tr.appendChild(optsTd);

      // image name + upload
      const imgTd = document.createElement('td');
      const imgNameInput = document.createElement('input'); imgNameInput.type='text'; imgNameInput.placeholder='image name'; imgNameInput.value = data.imageName || '';
      const fileInput = document.createElement('input'); fileInput.type='file'; fileInput.accept='image/*';
      imgTd.appendChild(imgNameInput); imgTd.appendChild(fileInput);
      tr.appendChild(imgTd);

      // Save
      const saveTd = document.createElement('td');
      const saveBtn = document.createElement('button'); saveBtn.textContent='Save';
      saveBtn.onclick = async () => {
        const suffix = (suffixInput.value || '').trim();
        const nameVal = (nameInput.value || '').trim();
        const priceVal = (priceInput.value || '').trim();
        const descVal = (descInput.value || '').trim();
        const categoryVal =
          catCoffee.checked    ? 'coffee' :
          catNotCoffee.checked ? 'not-coffee' :
          catPif.checked       ? 'pif' :
          catSpecials.checked  ? 'specials' :
          '';
        const typeVal = typeDrink.checked ? 'drink' : '';
        const suffixFull = typeVal ? `${suffix}.${typeVal}` : suffix;
        const imageNameVal = (imgNameInput.value || '').trim();
        let base64 = '';

        if (!suffix || !nameVal || !categoryVal) { showError('Suffix, item name, and category are required.'); return; }
        if (fileInput.files && fileInput.files[0]) base64 = await readFileAsBase64(fileInput.files[0]);

        try {
          // Clear previous keys if category, suffix, or type changed
          const prevCat = data.category;
          const prevSuffix = data.suffix;
          const prevType = data.type || '';
          if (prevCat && prevSuffix &&
              (prevCat !== categoryVal || prevSuffix !== suffix || prevType !== typeVal)) {
            const prevKey = prevType ? `${prevSuffix}.${prevType}` : prevSuffix;
            const paths = [
              `menu.${prevCat}.${prevKey}`,
              `price.${prevCat}.${prevKey}`,
              `desc.${prevCat}.${prevKey}`,
              `image.${prevCat}.${prevKey}`,
              `image.${prevCat}.${prevKey}.name`,
              `alt.${prevCat}.${prevKey}`,
              `extra.${prevCat}.${prevKey}`,
              `syrups-on.${prevCat}.${prevKey}`,
              `syrup-on.${prevCat}.${prevKey}`,
              `coffee-on.${prevCat}.${prevKey}`,
            ];
            for (const p of paths) await apiDelete(p);
          }

          // Standard fields
          await apiUpsert(`menu.${categoryVal}.${suffixFull}`, nameVal);
          if (priceVal) await apiUpsert(`price.${categoryVal}.${suffixFull}`, priceVal); else await apiDelete(`price.${categoryVal}.${suffixFull}`);
          if (descVal) await apiUpsert(`desc.${categoryVal}.${suffixFull}`, descVal); else await apiDelete(`desc.${categoryVal}.${suffixFull}`);
          if (base64) {
            await apiUpsert(`image.${categoryVal}.${suffixFull}`, base64);
          } else if (!imageNameVal) {
            await apiDelete(`image.${categoryVal}.${suffixFull}`);
          }
          if (imageNameVal) await apiUpsert(`image.${categoryVal}.${suffixFull}.name`, imageNameVal); else await apiDelete(`image.${categoryVal}.${suffixFull}.name`);

          // Eligibility flags
          if (cAlt.cb.checked) await apiUpsert(`alt.${categoryVal}.${suffixFull}`, '1'); else await apiDelete(`alt.${categoryVal}.${suffixFull}`);
          if (cExtra.cb.checked) await apiUpsert(`extra.${categoryVal}.${suffixFull}`, '1'); else await apiDelete(`extra.${categoryVal}.${suffixFull}`);
          if (cSyrups.cb.checked) {
            await apiUpsert(`syrups-on.${categoryVal}.${suffixFull}`, '1');
            await apiUpsert(`syrup-on.${categoryVal}.${suffixFull}`, '1'); // optional compat
          } else {
            await apiDelete(`syrups-on.${categoryVal}.${suffixFull}`);
            await apiDelete(`syrup-on.${categoryVal}.${suffixFull}`);
          }
          if (cCoffee.cb.checked) await apiUpsert(`coffee-on.${categoryVal}.${suffixFull}`, '1'); else await apiDelete(`coffee-on.${categoryVal}.${suffixFull}`);

          showStatus('Saved');
          data.category = categoryVal;
          data.suffix = suffix;
          data.type = typeVal;
        } catch (e) { showError(e.message || 'Save failed'); return; }
        try {
          await loadAll();
        } catch (e) {
          showError(e.message || 'Refresh failed');
        }
      };
      saveTd.appendChild(saveBtn);
      tr.appendChild(saveTd);

      // Remove (clear all categories + flags)
      const removeTd = document.createElement('td');
      const removeBtn = document.createElement('button'); removeBtn.textContent='Remove';
      if (!canDelete) {
        removeBtn.disabled = true;
      } else {
        removeBtn.onclick = async () => {
          removeBtn.disabled = true; removeBtn.textContent = 'Removing...';
          const currSuffix = (suffixInput.value || '').trim();


          // collect base suffixes from original data and current input
          const bases = new Set();
          if (data.suffix) bases.add(data.suffix);
          if (currSuffix) bases.add(currSuffix);

          // if nothing to clear just remove the row locally
          if (bases.size === 0) { tr.remove(); return; }

          // derive suffix variants: plain and with .drink
          const suffixes = new Set();
          for (const b of bases) {
            suffixes.add(b);
            suffixes.add(`${b}.drink`);
          }

          try {
            const keys = [];
            for (const cat of ['coffee','not-coffee','pif','specials'])
              for (const suf of suffixes)
                keys.push(
                  `menu.${cat}.${suf}`,
                  `price.${cat}.${suf}`,
                  `desc.${cat}.${suf}`,
                  `image.${cat}.${suf}`,
                  `image.${cat}.${suf}.name`,
                  `alt.${cat}.${suf}`,
                  `extra.${cat}.${suf}`,
                  `syrups-on.${cat}.${suf}`,
                  `syrup-on.${cat}.${suf}`,
                  `coffee-on.${cat}.${suf}`
                );

            await Promise.allSettled(keys.map(k => apiDelete(k)));
          } catch (e) {
            showError(e.message || 'Remove failed');
          }
          tr.remove();
          showStatus('Removed');
          try {
            await loadAll();
          } catch (e) {
            showError(e.message || 'Refresh failed');
          }
        };
      }
      removeTd.appendChild(removeBtn);
      tr.appendChild(removeTd);

      tbody.appendChild(tr);
    }

    const addBtn = document.getElementById('addMenuRow');
    if (addBtn) addBtn.addEventListener('click', () => addMenuRow());

    // Render menu from CMS map (no special endpoints)
    function renderMenu(map){
      const tbody = document.getElementById('menuRows');
      if (!tbody) return;
      tbody.innerHTML = '';
      const items = {};

      Object.keys(map || {}).forEach((key) => {
        if (!key.startsWith('menu.')) return;
        const parts = key.split('.');
        if (parts.length < 3) return; // menu.<category>.<suffix...>
        const category = parts[1];
        const suffixParts = parts.slice(2);
        let type = '';
        if (suffixParts[suffixParts.length - 1] === 'drink') {
          type = 'drink';
          suffixParts.pop();
        }
        const suffix = suffixParts.join('.');
        const suffixKey = type ? `${suffix}.drink` : suffix;

        const item = items[suffixKey] || { suffix, type };
        item.category = category;
        item.name = map[key] || '';

        item.price = map[`price.${category}.${suffixKey}`] || '';
        item.desc = map[`desc.${category}.${suffixKey}`] || '';
        item.imageName = map[`image.${category}.${suffixKey}.name`] || '';

        // eligibility flags
        item.optAlt    = !!map[`alt.${category}.${suffixKey}`];
        item.optExtra  = !!map[`extra.${category}.${suffixKey}`];
        item.optSyrups = !!(map[`syrups-on.${category}.${suffixKey}`] || map[`syrup-on.${category}.${suffixKey}`]);
        item.optCoffee = !!map[`coffee-on.${category}.${suffixKey}`];

        items[suffixKey] = item;
      });

      Object.values(items).forEach(entry => addMenuRow(entry));
    }

    // ---- Coffee & Syrups tables ----
    function renderPrefixTable(map, prefix, containerId) {
      const box = document.getElementById(containerId);
      if (!box) return;
      box.innerHTML = '';

      const keys = Object.keys(map || {}).filter(k => k.startsWith(prefix + '.')).sort();
      if (!keys.length) { box.innerHTML = '<div>No entries yet.</div>'; return; }

      keys.forEach(k => {
        const row = document.createElement('div'); row.className = 'row';
        const lab = document.createElement('label'); lab.textContent = k; row.appendChild(lab);
        const inp = document.createElement('input'); inp.type = 'text'; inp.value = map[k] || ''; row.appendChild(inp);

        const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save';
        saveBtn.onclick = async () => { try { await apiUpsert(k, inp.value); showStatus('Saved'); } catch(e){ showError(e.message || 'Save failed'); } };
        row.appendChild(saveBtn);

      const rmBtn = document.createElement('button'); rmBtn.textContent = 'Remove';
      if (!canDelete) {
        rmBtn.disabled = true;
      } else {
        rmBtn.onclick = async () => {
          const prevText = rmBtn.textContent;
          rmBtn.disabled = true; rmBtn.textContent = 'Removing...';
          try {
            await apiDelete(k);
            row.remove();
            showStatus('Removed');
          } catch(e){
            showError(e.message || 'Remove failed');
            rmBtn.disabled = false; rmBtn.textContent = prevText;
            return;
          }
          try {
            await loadAll();
          } catch (e) {
            showError(e.message || 'Refresh failed');
          }
        };
      }
      row.appendChild(rmBtn);

        box.appendChild(row);
      });
    }

    function wireAddForms(){
      const coffeeForm = document.getElementById('addCoffeeForm');
      if (coffeeForm && !coffeeForm.dataset.bound) {
        coffeeForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const suf = (document.getElementById('coffeeSuffix').value || '').trim();
          const lab = (document.getElementById('coffeeLabel').value || '').trim();
          if (!suf || !lab) return;
          try {
            await apiUpsert(`coffee.${suf}`, lab);
            document.getElementById('coffeeSuffix').value='';
            document.getElementById('coffeeLabel').value='';
            showStatus('Saved');
          } catch(e){ showError(e.message || 'Save failed'); return; }
          try {
            await loadAll();
          } catch (e) {
            showError(e.message || 'Refresh failed');
          }
        });
        coffeeForm.dataset.bound = '1';
      }

      const syrupForm = document.getElementById('addSyrupForm');
      if (syrupForm && !syrupForm.dataset.bound) {
        syrupForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const suf = (document.getElementById('syrupSuffix').value || '').trim();
          const lab = (document.getElementById('syrupLabel').value || '').trim();
          if (!suf || !lab) return;
          try {
            await apiUpsert(`syrups.${suf}`, lab);
            document.getElementById('syrupSuffix').value='';
            document.getElementById('syrupLabel').value='';
            showStatus('Saved');
          } catch(e){ showError(e.message || 'Save failed'); return; }
          try {
            await loadAll();
          } catch (e) {
            showError(e.message || 'Refresh failed');
          }
        });
        syrupForm.dataset.bound = '1';
      }
    }

    function renderCoffeeAndSyrups(map){
      renderPrefixTable(map, 'coffee', 'coffeeRows');
      renderPrefixTable(map, 'syrups', 'syrupsRows');
      wireAddForms();
    }

    // ---- Page load orchestration ----
    async function verifyConfig(){
      const anon = getAnon();
      if(!anon){ showError('Supabase Anon key missing. Click “Set Supabase anon key” (top bar).'); return false; }
      const url = getFnsUrl();
      if(!url){ showError('Functions URL missing. Click “Set Functions URL” (top bar).'); return false; }
      try{ await fetch(`${url}/cms-get`, { method:'GET', headers:{ 'Authorization': `Bearer ${anon}`, 'apikey': anon }}); }
      catch(e){ showError('Supabase Functions URL unreachable. Check the URL and network.'); return false; }
      return true;
    }

    async function loadAll(){
      try{
        const data = await apiGetAll();
        renderHours(data);
        renderList(data);
        renderMenu(data);
        renderCoffeeAndSyrups(data);
      }catch(err){
        if(err?.status || err?.body) console.error(err.status, err.body);
        else console.error(err);
        const statusPart = err?.status ? ` (status ${err.status})` : '';
        const msg = err?.message ? `Load failed${statusPart}: ${err.message}` : `Load failed${statusPart}`;
        showError(msg);
      }
    }

    // ---- Events ----
    $id('enter').addEventListener('click', async ()=>{
      const ok = checkPassword($id('pw').value, false);
      if(ok && !getAnon()) showStatus('Click “Set Supabase anon key” (top bar) to enable saving.', 4000);
      if(ok && await verifyConfig()) loadAll();
    });
    $id('remember').addEventListener('click', async ()=>{
      const ok = checkPassword($id('pw').value, true);
      if(ok && !getAnon()) showStatus('Click “Set Supabase anon key” (top bar) to enable saving.', 4000);
      if(ok && await verifyConfig()) loadAll();
    });

    $id('resetAuth').addEventListener('click', ()=>{ clearAuth(); showStatus('Page password reset. Reloading...'); setTimeout(()=>location.reload(), 500); });
    $id('setAnon').addEventListener('click', ()=>{
      const next = prompt('Paste your Supabase ANON key:', getAnon()||'');
      if(next){ setAnon(next); showStatus('Anon key saved.'); }
    });
    $id('setFnsUrl').addEventListener('click', ()=>{
      const next = prompt('Supabase Functions URL:', getFnsUrl());
      if(next){ setFnsUrl(next); showStatus('Functions URL saved.'); }
    });

    $id('saveHoursAll').addEventListener('click', async ()=>{
      try{
        const rows = document.querySelectorAll('#hoursRows .hoursRow');
        for(const row of rows){
          const day = row.dataset.day;
          if(row.dataset.type==='simple'){
            const openVal = row.querySelector('input[data-kind="open"]').value;
            const closeVal = row.querySelector('input[data-kind="close"]').value;
            await apiUpsert(hoursKey(day,'open'), openVal);
            await apiUpsert(hoursKey(day,'close'), closeVal);
          }else if(row.dataset.type==='split' && day==='fri'){
            const open1 = row.querySelector('input[data-kind="open1"]').value;
            const close1 = row.querySelector('input[data-kind="close1"]').value;
            const open2 = row.querySelector('input[data-kind="open2"]').value;
            const close2 = row.querySelector('input[data-kind="close2"]').value;
            await apiUpsert(hoursKey('fri','open1'), open1);
            await apiUpsert(hoursKey('fri','close1'), close1);
            await apiUpsert(hoursKey('fri','open2'), open2);
            await apiUpsert(hoursKey('fri','close2'), close2);
          }
        }
        showStatus('All hours saved');
      }catch(e){ showError(e.message||'Save failed'); }
    });

    document.getElementById('addForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const key = (document.getElementById('newKey').value||'').trim();
      const val = document.getElementById('newVal').value||'';
      if(!key) return;
      try{
        await apiUpsert(key, val);
        document.getElementById('newKey').value='';
        document.getElementById('newVal').value='';
        showStatus('Saved');
      }catch(e){ showError(e.message||'Save failed'); return; }
      try {
        await loadAll();
      } catch (e) {
        showError(e.message || 'Refresh failed');
      }
    });

    if(localStorage.getItem('ruminateAuth')==='true'){
      verifyConfig().then(ok => { if(ok) loadAll(); });
    }
