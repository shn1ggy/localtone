import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {menuLabel,normalizeMenu} from '../app/context-menu.js';
test('menu ellipses signal additional input consistently',()=>{for(const label of ['Edit tags','Rename','Playlist settings','Reconnect folder'])assert.equal(menuLabel(label+'...'),label+'…');for(const label of ['Open folder','Add to play queue','Rescan folder','Delete library','Lock seek bar height','Year'])assert.equal(menuLabel(label+'…'),label);});

test('metadata editing precedes renaming in every normalized menu',()=>{const dom=new JSDOM('<div id="menu"><button>Rename files and folders</button><button>Open folder</button><button>Edit tags</button><button>Add leading zeros</button></div>');try{const menu=dom.window.document.getElementById('menu');normalizeMenu(menu);assert.deepEqual([...menu.querySelectorAll('button')].map(b=>b.textContent),['Edit tags…','Rename files and folders…','Add leading zeros','Open folder']);}finally{dom.window.close();}});

test('track-number commands stay together in requested add totals, pad, unpad order',()=>{
 const dom=new JSDOM('<div><button>Remove leading zeros</button><button>Open folder</button><button>Add leading zeros</button><button>Edit tags</button><button>Add total tracks</button><button>Renumber by folder order</button></div>');
 try{const menu=dom.window.document.querySelector('div');normalizeMenu(menu);assert.deepEqual([...menu.querySelectorAll('button')].map(b=>b.textContent),['Edit tags…','Renumber by folder order','Add total tracks','Add leading zeros','Remove leading zeros','Open folder']);const nodes=[...menu.children];const start=nodes.findIndex(n=>n.textContent==='Add total tracks');assert.equal(nodes[start+1].textContent,'Add leading zeros');assert.equal(nodes[start+2].textContent,'Remove leading zeros');}finally{dom.window.close();}
});
