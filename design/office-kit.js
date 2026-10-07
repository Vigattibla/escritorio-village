var OK = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region src/chibi/sprite.ts
	var SKINS = [
		"#ffe3cc",
		"#f6c9a3",
		"#e2aa7e",
		"#c4864f",
		"#8d5a3b",
		"#5c3923"
	];
	var HAIR_COLORS = [
		"#2b1d16",
		"#5a3825",
		"#8b5a2b",
		"#d9a441",
		"#f2d16b",
		"#b5452f",
		"#9aa0a6",
		"#7b5cd6",
		"#2f7de1",
		"#e86fa6"
	];
	var TOPS = [
		"#0B235D",
		"#FBC222",
		"#e05a47",
		"#3fa66b",
		"#4a90d9",
		"#8e5bd6",
		"#f28cb1",
		"#f4f4f4",
		"#2d2d33",
		"#f39c35"
	];
	var BOTTOMS = [
		"#2c3e66",
		"#1f1f24",
		"#7a5a3a",
		"#5a6b7a",
		"#c9b48a",
		"#3d5a3a",
		"#8e5bd6"
	];
	var SHOES = [
		"#1f1f24",
		"#f4f4f4",
		"#7a4a2a",
		"#c0392b",
		"#2f7de1",
		"#FBC222"
	];
	var HAIR_STYLES = [
		{
			id: "curto",
			label: "Curto"
		},
		{
			id: "longo",
			label: "Longo"
		},
		{
			id: "coque",
			label: "Coque"
		},
		{
			id: "cacheado",
			label: "Cacheado"
		},
		{
			id: "raspado",
			label: "Raspado"
		}
	];
	var OUTFITS = [
		{
			id: "camiseta",
			label: "Camiseta"
		},
		{
			id: "moletom",
			label: "Moletom"
		},
		{
			id: "social",
			label: "Social"
		},
		{
			id: "vestido",
			label: "Vestido"
		},
		{
			id: "terno",
			label: "Terno"
		}
	];
	var DEFAULT_AVATAR = {
		skin: SKINS[1],
		hair: "curto",
		hairColor: HAIR_COLORS[1],
		outfit: "camiseta",
		top: "#0B235D",
		bottom: BOTTOMS[0],
		shoes: SHOES[0],
		face: "pixel",
		pixelPhoto: true
	};
	var SPRITE_W = 16;
	var SPRITE_H = 27;
	var HEAD_Y = 3;
	var BODY_Y = 15;
	var OUT$1 = "#1d1a2b";
	function shade(hex, f = .78) {
		const n = parseInt(hex.slice(1), 16);
		const r = Math.round((n >> 16 & 255) * f);
		const g = Math.round((n >> 8 & 255) * f);
		const b = Math.round((n & 255) * f);
		return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
	}
	var HEAD = [
		"....oooo",
		"..oossss",
		".ossssss",
		"osssssss",
		"osssssss",
		"osssssss",
		"osssssss",
		"osssssss",
		"osssssss",
		".ossssss",
		"..oossss",
		"....oooo"
	];
	var HAIR = {
		curto: {
			yo: 0,
			rows: [
				"....oooo",
				"..oorrrr",
				".orrrrrr",
				"orrrrrrr",
				"orrrRrrr",
				"orr..rrr",
				"or......"
			]
		},
		longo: {
			yo: 0,
			rows: [
				"....oooo",
				"..oorrrr",
				".orrrrrr",
				"orrrrrrr",
				"orrrRrrr",
				"orrr.rrr",
				"orr.....",
				"orr.....",
				"orr.....",
				"orR.....",
				"orr.....",
				"orr.....",
				"orR.....",
				".or.....",
				"..o....."
			]
		},
		coque: {
			yo: -3,
			rows: [
				"......oo",
				".....orr",
				".....oRr",
				"....oooo",
				"..oorrrr",
				".orrrrrr",
				"orrrRrrr",
				"orrr..rr",
				"or......"
			]
		},
		cacheado: {
			yo: -2,
			rows: [
				"...ooooo",
				"..orrrrr",
				".orrRrrr",
				"orrrrrRr",
				"orRrrrrr",
				"orrrrRrr",
				"orrrrrrr",
				"orr.rr.r",
				"orr.....",
				"oRr.....",
				"orr.....",
				".oo....."
			]
		},
		raspado: {
			yo: 0,
			rows: [
				"....oooo",
				"..ooRRRR",
				".oRRRRRR",
				"oR......"
			]
		}
	};
	var CAMISETA = [
		"......os",
		"...ooccc",
		"..occccc",
		".oCccccc",
		".oCccccc",
		".oCccccc",
		".ossCccc",
		"..oppppp",
		"...opppo",
		"...opppo",
		"..ohhhho",
		"..oooooo"
	];
	var BODY = {
		camiseta: CAMISETA,
		moletom: [
			".....oCs",
			"...oocac",
			"..occcac",
			".oCccccc",
			".oCcCCCC",
			".oCcCCCC",
			".ossCccc",
			...CAMISETA.slice(7)
		],
		social: [
			"......ow",
			"...oocwt",
			"..occcwt",
			".oCcccwt",
			".oCcccwt",
			".oCcccwt",
			".ossCccc",
			...CAMISETA.slice(7)
		],
		terno: [
			".....oos",
			"...oocwT",
			".oocccwt",
			"oCccccwt",
			"oCccccct",
			"oCcccccc",
			"oCcccccc",
			"ossCcccc",
			".ooCCCCC",
			"...opppo",
			"..ohhhho",
			"..oooooo"
		],
		vestido: [
			...CAMISETA.slice(0, 7),
			"..oCcccc",
			".oCccccc",
			".oCCCCCC",
			"...osso.",
			"...ohho."
		]
	};
	var cache = /* @__PURE__ */ new Map();
	function cell(half, c) {
		return c < 8 ? half[c] : half[15 - c];
	}
	/** Corpo (e cabeça pixel, se withHead) num canvas 16x27, cacheado. */
	function bodySprite(av, dir, frame, withHead) {
		const key = [
			av.skin,
			av.hair,
			av.hairColor,
			av.outfit,
			av.top,
			av.bottom,
			av.shoes,
			dir,
			frame,
			withHead
		].join("|");
		const hit = cache.get(key);
		if (hit) return hit;
		const cv = document.createElement("canvas");
		cv.width = 16;
		cv.height = 27;
		const ctx = cv.getContext("2d");
		if (dir === "left") {
			ctx.translate(16, 0);
			ctx.scale(-1, 1);
			ctx.drawImage(bodySprite(av, "right", frame, withHead), 0, 0);
			cache.set(key, cv);
			return cv;
		}
		const back = dir === "up";
		const pal = {
			o: OUT$1,
			s: av.skin,
			S: shade(av.skin),
			c: av.top,
			C: shade(av.top),
			p: av.bottom,
			P: shade(av.bottom),
			h: av.shoes,
			w: "#ffffff",
			t: "#c8403a",
			T: "#8f2b26",
			a: "#f4f4f4",
			r: av.hairColor,
			R: shade(av.hairColor, .72),
			e: OUT$1,
			b: "#f4a3a0",
			m: "#8a3b3b"
		};
		const px = (x, y, ch) => {
			ctx.fillStyle = pal[ch];
			ctx.fillRect(x, y, 1, 1);
		};
		BODY[av.outfit].forEach((half, r) => {
			for (let c = 0; c < 16; c++) {
				let ch = cell(half, c);
				if (ch === ".") continue;
				if (back && "wtTa".includes(ch)) ch = "c";
				const lift = r >= (av.outfit === "terno" ? 9 : 8) && (frame === 1 && c < 8 || frame === 2 && c >= 8) ? 1 : 0;
				px(c, BODY_Y + r - lift, ch);
			}
		});
		if (withHead) {
			HEAD.forEach((half, r) => {
				for (let c = 0; c < 16; c++) {
					let ch = cell(half, c);
					if (ch === ".") continue;
					if (back && ch === "s") ch = av.hair === "raspado" && r > 3 ? "s" : "r";
					px(c, HEAD_Y + r, ch);
				}
			});
			if (!back) {
				const dx = dir === "right" ? 1 : 0;
				for (const ex of [5, 10]) {
					px(ex + dx, 9, "e");
					px(ex + dx, 10, "e");
				}
				px(3 + dx, 11, "b");
				px(12 + dx, 11, "b");
				px(7 + dx, 12, "m");
				px(8 + dx, 12, "m");
			}
			const hs = HAIR[av.hair];
			hs.rows.forEach((half, r) => {
				for (let c = 0; c < 16; c++) {
					const ch = cell(half, c);
					if (ch === ".") continue;
					px(c, HEAD_Y + hs.yo + r, ch);
				}
			});
		}
		cache.set(key, cv);
		return cv;
	}
	var photos = /* @__PURE__ */ new Map();
	function photo(url) {
		let e = photos.get(url);
		if (e) return e;
		const img = new Image();
		e = {
			img,
			pix: null,
			ready: false,
			subs: /* @__PURE__ */ new Set()
		};
		const entry = e;
		img.onload = () => {
			const pix = document.createElement("canvas");
			pix.width = pix.height = 20;
			const c = pix.getContext("2d");
			c.imageSmoothingEnabled = true;
			c.imageSmoothingQuality = "high";
			c.drawImage(img, 0, 0, 20, 20);
			entry.pix = pix;
			entry.ready = true;
			entry.subs.forEach((f) => f());
		};
		img.src = url;
		photos.set(url, e);
		return e;
	}
	function onPhotoLoad(url, cb) {
		const e = photo(url);
		e.subs.add(cb);
		return () => {
			e.subs.delete(cb);
		};
	}
	/** Desenha o personagem com o topo-esquerdo em (x, y), em unidades lógicas. */
	function drawAvatar(ctx, av, photoUrl, x, y, dir, frame) {
		const usePhoto = av.face === "foto" && !!photoUrl && dir !== "up";
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(bodySprite(av, dir, frame, !usePhoto), x, y);
		if (!usePhoto) return;
		const e = photo(photoUrl);
		const cx = x + 8 + (dir === "right" ? .5 : dir === "left" ? -.5 : 0);
		const cy = y + HEAD_Y + 6;
		const r = 7.5;
		ctx.save();
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		if (e.ready) {
			ctx.clip();
			if (av.pixelPhoto && e.pix) {
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(e.pix, cx - r, cy - r, r * 2, r * 2);
			} else {
				ctx.imageSmoothingEnabled = true;
				ctx.drawImage(e.img, cx - r, cy - r, r * 2, r * 2);
			}
		} else {
			ctx.fillStyle = av.skin;
			ctx.fill();
		}
		ctx.restore();
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.lineWidth = .8;
		ctx.strokeStyle = OUT$1;
		ctx.stroke();
		ctx.imageSmoothingEnabled = false;
	}
	//#endregion
	//#region src/office/world.ts
	var T = 16;
	var MW = 30;
	var MH = 20;
	var MAX_DESKS = 12;
	/** Mesa do Gerente (fila de baixo, centralizada) — fora do sorteio de mesas */
	var BOSS_DESK = 12;
	var DESKS = 13;
	var SOLID = /* @__PURE__ */ new Set([
		"#",
		"f",
		"w",
		"B",
		"|",
		"-",
		"P",
		"T",
		"S",
		"K",
		"R"
	]);
	/** Onde o boneco para para escrever no quadro / mexer na estante (tile) */
	var BOARD_SPOT = {
		tx: 14,
		ty: 2
	};
	var SHELF_SPOT = {
		tx: 6,
		ty: 3
	};
	function deskOf(i) {
		if (i === 12) return {
			tx: 7,
			ty: 17,
			w: 3,
			seat: {
				x: 136,
				y: 280
			}
		};
		const col = i % 4;
		const row = Math.floor(i / 4);
		const tx = 2 + col * 4;
		const ty = 4 + row * 5;
		return {
			tx,
			ty,
			w: 2,
			seat: {
				x: (tx + 1) * 16,
				y: ty * 16 + 8
			}
		};
	}
	function build() {
		const g = Array.from({ length: 20 }, () => Array(30).fill("."));
		const set = (x, y, c) => {
			g[y][x] = c;
		};
		for (let x = 0; x < 30; x++) {
			set(x, 0, "#");
			set(x, 1, "f");
			set(x, 19, "#");
		}
		for (let y = 0; y < 20; y++) {
			set(0, y, "#");
			set(29, y, "#");
		}
		for (const x of [
			3,
			4,
			8,
			9,
			22,
			23,
			26,
			27
		]) set(x, 1, "w");
		for (const x of [
			13,
			14,
			15
		]) set(x, 1, "B");
		for (let y = 2; y <= 9; y++) for (let x = 20; x <= 28; x++) set(x, y, ",");
		for (let y = 11; y <= 18; y++) for (let x = 20; x <= 28; x++) set(x, y, "_");
		for (let y = 2; y < 19; y++) if (![
			5,
			6,
			14,
			15
		].includes(y)) set(19, y, "|");
		for (let x = 19; x <= 28; x++) if (![23, 24].includes(x)) set(x, 10, "-");
		for (let y = 4; y <= 7; y++) for (let x = 22; x <= 26; x++) set(x, y, "T");
		for (let x = 21; x <= 24; x++) set(x, 17, "S");
		for (let x = 25; x <= 27; x++) set(x, 11, "K");
		for (const x of [
			5,
			6,
			7
		]) set(x, 2, "R");
		for (const [x, y] of [
			[1, 2],
			[18, 2],
			[1, 18],
			[18, 18],
			[28, 2],
			[20, 9],
			[28, 18],
			[20, 11]
		]) set(x, y, "P");
		for (let i = 0; i < 13; i++) {
			const d = deskOf(i);
			for (let k = 0; k < d.w; k++) set(d.tx + k, d.ty, "D");
		}
		return g;
	}
	var grid = build();
	function cellAt(tx, ty) {
		if (tx < 0 || ty < 0 || tx >= 30 || ty >= 20) return "#";
		return grid[ty][tx];
	}
	function blocked(x, y) {
		const tx = Math.floor(x / 16);
		const ty = Math.floor(y / 16);
		const c = cellAt(tx, ty);
		if (c === "D") return y - ty * 16 >= 9;
		return SOLID.has(c);
	}
	function deskAtTile(tx, ty) {
		for (let i = 0; i < 13; i++) {
			const d = deskOf(i);
			if (tx >= d.tx && tx < d.tx + d.w && (ty === d.ty || ty === d.ty - 1)) return i;
		}
		return null;
	}
	var walkable = (tx, ty) => {
		const c = cellAt(tx, ty);
		return !SOLID.has(c) && c !== "D";
	};
	/** BFS em tiles; devolve centros dos tiles do caminho (sem o inicial). */
	function findPath(sx, sy, gx, gy) {
		const s = [Math.floor(sx / 16), Math.floor(sy / 16)];
		if (!walkable(gx, gy)) return null;
		const key = (x, y) => y * 30 + x;
		const prev = /* @__PURE__ */ new Map([[key(s[0], s[1]), -1]]);
		const q = [[s[0], s[1]]];
		while (q.length) {
			const [x, y] = q.shift();
			if (x === gx && y === gy) break;
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = x + dx, ny = y + dy;
				if (!walkable(nx, ny) || prev.has(key(nx, ny))) continue;
				prev.set(key(nx, ny), key(x, y));
				q.push([nx, ny]);
			}
		}
		if (!prev.has(key(gx, gy))) return null;
		const out = [];
		for (let k = key(gx, gy); k !== key(s[0], s[1]) && k !== -1; k = prev.get(k)) out.unshift({
			x: (k % 30 + .5) * 16,
			y: (Math.floor(k / 30) + .5) * 16
		});
		return out;
	}
	function pathToSeat(px, py, desk) {
		const d = deskOf(desk);
		const p = findPath(px, py, d.tx, d.ty - 1);
		if (!p) return null;
		return [
			...p,
			{
				x: d.seat.x,
				y: (d.ty - .5) * 16
			},
			d.seat
		];
	}
	var OUT = "#1d1a2b";
	function rect(c, color, x, y, w, h) {
		c.fillStyle = color;
		c.fillRect(x, y, w, h);
	}
	function disc(c, cx, cy, r, color) {
		for (let dy = -r; dy <= r; dy++) {
			const h = Math.round(Math.sqrt((r + .4) ** 2 - dy * dy));
			rect(c, color, cx - h, cy + dy, 2 * h + 1, 1);
		}
	}
	/** Caixa com contorno de 1px */
	function box(c, color, x, y, w, h) {
		rect(c, OUT, x - 1, y - 1, w + 2, h + 2);
		rect(c, color, x, y, w, h);
	}
	var PLANK = [
		"#dcb68b",
		"#d5ad81",
		"#e1bd93"
	];
	var WALL = "#3b302c";
	var WALL_HI = "#5a4840";
	var PAPER = "#f1e6d2";
	var PAPER_2 = "#e9dbc3";
	var WAIN = "#a8774c";
	var WAIN_D = "#8e6240";
	var WAIN_HI = "#bd8c5f";
	var BASE = "#5e3f2a";
	var SHADOW = "rgba(70,40,20,.2)";
	var BOOKS = [
		"#d9694a",
		"#e0b04a",
		"#7a8b3a",
		"#5b6e8f",
		"#f1e6d2",
		"#8a6bc8",
		"#c0643b"
	];
	/** Piso de tábuas corridas na horizontal, emenda desencontrada e tom variando por tábua */
	function wood(c, x, y) {
		for (let r = 0; r < 4; r++) {
			const R = y / 4 + r, o = R * 13 % 40, py = y + r * 4;
			let px = x;
			while (px < x + 16) {
				const seg = Math.floor((px + o) / 40), end = Math.min(x + 16, (seg + 1) * 40 - o);
				rect(c, PLANK[(seg * 7 + R * 5) % 3], px, py, end - px, 3);
				rect(c, "#c49a6c", px, py + 3, end - px, 1);
				if ((px + o) % 40 === 0) rect(c, "#b48a5f", px, py, 1, 3);
				px = end;
			}
		}
	}
	function tiles(c, x, y) {
		rect(c, "#efe6d6", x, y, 16, 16);
		rect(c, "#e5d9c4", x, y, 8, 8);
		rect(c, "#e5d9c4", x + 8, y + 8, 8, 8);
		rect(c, "#d9cbb3", x, y, 16, 1);
		rect(c, "#d9cbb3", x, y, 1, 16);
	}
	/** Parede alta: a linha 0 é a metade de cima (papel de parede), a linha 1 tem lambri e rodapé */
	function upperWall(c, x, y) {
		rect(c, WALL, x, y, 16, 4);
		rect(c, WALL_HI, x, y + 4, 16, 1);
		rect(c, PAPER, x, y + 5, 16, 11);
		for (let i = 2; i < 16; i += 4) rect(c, PAPER_2, x + i, y + 5, 1, 11);
	}
	function wallFace(c, x, y) {
		rect(c, PAPER, x, y, 16, 7);
		for (let i = 2; i < 16; i += 4) rect(c, PAPER_2, x + i, y, 1, 7);
		rect(c, "#d9bf98", x, y + 7, 16, 1);
		rect(c, WAIN, x, y + 8, 16, 6);
		rect(c, WAIN_HI, x, y + 8, 16, 1);
		rect(c, WAIN_D, x + 7, y + 9, 1, 5);
		rect(c, WAIN_D, x + 15, y + 9, 1, 5);
		rect(c, BASE, x, y + 14, 16, 2);
	}
	function plant(c, x, y) {
		const blobs = [
			[
				x + 3,
				y - 6,
				10,
				13
			],
			[
				x + 1,
				y - 2,
				14,
				7
			],
			[
				x + 5,
				y - 9,
				6,
				4
			]
		];
		for (const [bx, by, bw, bh] of blobs) rect(c, OUT, bx - 1, by - 1, bw + 2, bh + 2);
		for (const [bx, by, bw, bh] of blobs) rect(c, "#2f7a4f", bx, by, bw, bh);
		rect(c, "#3f9a62", x + 4, y - 7, 8, 10);
		rect(c, "#3f9a62", x + 2, y - 1, 5, 4);
		rect(c, "#3f9a62", x + 10, y - 2, 4, 4);
		rect(c, "#6cc08a", x + 6, y - 7, 3, 2);
		rect(c, "#6cc08a", x + 4, y - 4, 2, 2);
		rect(c, "#6cc08a", x + 11, y - 1, 2, 1);
		rect(c, OUT, x + 2, y + 6, 12, 4);
		rect(c, "#d97b4f", x + 3, y + 7, 10, 2);
		rect(c, OUT, x + 3, y + 9, 10, 7);
		rect(c, "#c0643b", x + 4, y + 9, 8, 6);
		rect(c, "#a8532f", x + 4, y + 13, 8, 2);
	}
	function frame(c, x, y, w, h) {
		box(c, "#8a5a36", x, y, w, h);
		rect(c, "#a8774c", x, y, w, 1);
		rect(c, PAPER, x + 1, y + 1, w - 2, h - 2);
	}
	var WINDOWS = [
		3,
		8,
		22,
		26
	];
	function renderBackground() {
		const cv = document.createElement("canvas");
		cv.width = 480;
		cv.height = 320;
		const c = cv.getContext("2d");
		for (let ty = 1; ty < 19; ty++) for (let tx = 1; tx < 29; tx++) if (tx >= 20 && ty >= 10) tiles(c, tx * 16, ty * 16);
		else wood(c, tx * 16, ty * 16);
		{
			const x0 = 330, y0 = 46;
			rect(c, "#7f8655", x0, y0, 124, 104);
			rect(c, "#9aa06a", 332, 48, 120, 100);
			rect(c, "#c9b98a", 334, 50, 116, 1);
			rect(c, "#c9b98a", 334, 145, 116, 1);
			rect(c, "#c9b98a", 334, 50, 1, 96);
			rect(c, "#c9b98a", 449, 50, 1, 96);
			for (let yy = 54; yy < 142; yy += 6) for (let xx = 338 + ((yy - y0) % 12 ? 3 : 0); xx < 446; xx += 6) rect(c, "#a8ae79", xx, yy, 1, 1);
		}
		rect(c, "#5a1f2c", 102, 250, 68, 50);
		rect(c, "#7a2e3a", 104, 252, 64, 46);
		rect(c, "#FBC222", 106, 254, 60, 1);
		rect(c, "#FBC222", 106, 295, 60, 1);
		rect(c, "#FBC222", 106, 254, 1, 42);
		rect(c, "#FBC222", 165, 254, 1, 42);
		for (const wx of WINDOWS) {
			c.fillStyle = "rgba(255,248,225,.22)";
			for (let k = 0; k < 22; k++) c.fillRect(wx * 16 + 3 + Math.floor(k / 2), 32 + k, 26, 1);
		}
		rect(c, SHADOW, 16, 32, 448, 3);
		rect(c, SHADOW, 16, 32, 3, 272);
		for (let x = 19; x <= 28; x++) if (![23, 24].includes(x)) rect(c, SHADOW, x * 16, 176, 16, 3);
		for (let i = 0; i < 13; i++) {
			const d = deskOf(i);
			rect(c, SHADOW, d.tx * 16, (d.ty + 1) * 16, d.w * 16, 3);
		}
		rect(c, SHADOW, 354, 128, 80, 3);
		rect(c, SHADOW, 337, 288, 64, 2);
		rect(c, SHADOW, 400, 192, 48, 3);
		for (let ty = 0; ty < 20; ty++) for (let tx = 0; tx < 30; tx++) if (grid[ty][tx] === "P") rect(c, SHADOW, tx * 16 + 2, ty * 16 + 15, 13, 3);
		for (let ty = 0; ty < 20; ty++) for (let tx = 0; tx < 30; tx++) {
			const x = tx * 16, y = ty * 16;
			switch (grid[ty][tx]) {
				case "#":
					if (ty === 0 && tx > 0 && tx < 29) {
						upperWall(c, x, y);
						break;
					}
					rect(c, WALL, x, y, 16, 16);
					if (tx === 0) rect(c, WALL_HI, x + 16 - 2, y, 2, 16);
					if (tx === 29) rect(c, WALL_HI, x, y, 2, 16);
					if (ty === 19 && tx > 0 && tx < 29) rect(c, WALL_HI, x, y, 16, 2);
					break;
				case "f":
				case "w":
				case "B":
					wallFace(c, x, y);
					break;
				case "|":
					rect(c, OUT, x + 5, y, 6, 16);
					rect(c, "#6e5446", x + 6, y, 4, 16);
					rect(c, "#8a6c5a", x + 6, y, 1, 16);
					if (cellAt(tx, ty - 1) !== "|") rect(c, "#9c7d69", x + 6, y, 4, 2);
					rect(c, "rgba(70,40,20,.16)", x + 11, y, 3, 16);
					break;
				case "-":
					rect(c, WALL, x, y, 16, 3);
					rect(c, WALL_HI, x, y + 3, 16, 1);
					rect(c, PAPER, x, y + 4, 16, 5);
					rect(c, WAIN, x, y + 9, 16, 5);
					rect(c, WAIN_HI, x, y + 9, 16, 1);
					rect(c, BASE, x, y + 14, 16, 2);
					break;
				case "P":
					plant(c, x, y);
					break;
				case "T":
					if (tx === 22 && ty === 4) {
						const w = 80, h = 64;
						box(c, "#c08b5c", x, y, w, 60);
						rect(c, "#d6a273", x, y, w, 2);
						for (let k = 10; k < 58; k += 9) rect(c, "#b47f52", x + 4, y + k, 72, 1);
						rect(c, OUT, x - 1, y + h - 5, 82, 5);
						rect(c, "#87583a", x, y + h - 5, w, 4);
						box(c, "#fbfbf8", x + 10, y + 12, 9, 11);
						rect(c, "#c9b98a", x + 12, y + 15, 5, 1);
						rect(c, "#c9b98a", x + 12, y + 18, 4, 1);
						box(c, "#c9ced8", x + 34, y + 20, 14, 9);
						rect(c, "#9aa3b5", x + 35, y + 27, 12, 1);
						box(c, "#fbfbf8", x + 60, y + 14, 4, 4);
						rect(c, "#6e4529", x + 61, y + 15, 2, 2);
						box(c, "#FBC222", x + 22, y + 38, 4, 4);
						box(c, "#fbfbf8", x + 58, y + 34, 10, 8);
						rect(c, "#d9694a", x + 58, y + 34, 10, 2);
					}
					break;
				case "S":
					if (tx === 21) {
						const w = 64;
						box(c, "#b4513d", x, y, w, 15);
						rect(c, "#c9604a", x + 3, y + 1, 58, 5);
						for (let k = 0; k < 3; k++) {
							rect(c, "#e08a6e", x + 4 + k * 19, y + 7, 18, 6);
							rect(c, "#ec9f84", x + 4 + k * 19, y + 7, 18, 1);
						}
						rect(c, "#9c4433", x, y + 13, w, 2);
						box(c, "#FBC222", x + 6, y + 3, 6, 5);
						box(c, "#f1e6d2", x + w - 12, y + 3, 6, 5);
					}
					break;
				case "K":
					if (tx === 25) {
						box(c, "#a8774c", x, y + 3, 48, 13);
						rect(c, "#ece5d8", x - 1, y, 50, 5);
						rect(c, OUT, x - 1, y - 1, 50, 1);
						rect(c, "#d9cbb3", x - 1, y + 4, 50, 1);
						for (let k = 1; k < 3; k++) rect(c, WAIN_D, x + k * 16, y + 5, 1, 11);
						for (let k = 0; k < 3; k++) rect(c, "#e0c38c", x + k * 16 + 7, y + 8, 2, 1);
						box(c, "#2d2d33", x + 4, y - 7, 8, 9);
						rect(c, "#e05a47", x + 9, y - 5, 1, 1);
						rect(c, "#555", x + 6, y - 1, 4, 2);
						box(c, "#fbfbf8", x + 16 + 3, y - 2, 3, 3);
						box(c, "#fbfbf8", x + 16 + 8, y - 2, 3, 3);
						rect(c, "#FBC222", x + 16 + 8, y - 2, 3, 1);
						box(c, "#f1e6d2", x + 32 + 2, y - 1, 11, 3);
						rect(c, "#e0b04a", x + 32 + 3, y - 3, 3, 2);
						rect(c, "#d9694a", x + 32 + 7, y - 3, 3, 2);
					}
					break;
				case "R": if (tx === 5) {
					const w = 48, y0 = y - 13;
					box(c, "#8a5a36", x, y0, w, 29);
					rect(c, "#a8774c", x, y0, w, 2);
					for (let s = 0; s < 3; s++) {
						const sy = y0 + 3 + s * 8;
						rect(c, "#5e3f2a", x + 2, sy, 44, 6);
						let bx = x + 3;
						for (let k = 0; bx < x + w - 5; k++) {
							const bw = 2 + ((k + s) % 3 === 0 ? 1 : 0), bh = 5 - (k * 3 + s) % 2;
							if ((k + s * 2) % 7 === 5) {
								bx += 3;
								continue;
							}
							rect(c, BOOKS[(k * 3 + s * 2) % BOOKS.length], bx, sy + 6 - bh, bw, bh);
							bx += bw + 1;
						}
					}
					rect(c, OUT, x, y + 15, w, 1);
					box(c, "#c0643b", x + 5, y0 - 4, 4, 3);
					rect(c, "#3f9a62", x + 4, y0 - 8, 6, 4);
					box(c, "#FBC222", x + w - 10, y0 - 5, 4, 4);
					rect(c, "#e0b04a", x + w - 9, y0 - 2, 2, 1);
				}
			}
		}
		for (const wx of WINDOWS) {
			const x0 = wx * 16 + 2, y0 = 6, w = 28, h = 17;
			box(c, "#f7f1e6", x0, y0, w, h);
			rect(c, "#bfe3f2", x0 + 2, 8, 24, 13);
			rect(c, "#a6d6ec", x0 + 2, 15, 24, 6);
			rect(c, "#e3f4fb", x0 + 4, 10, 2, 2);
			rect(c, "#e3f4fb", x0 + 6, 9, 2, 1);
			rect(c, "#e3f4fb", x0 + 17, 10, 2, 1);
			rect(c, "#f7f1e6", x0 + w / 2 - 1, y0, 2, h);
			rect(c, "#f7f1e6", x0, 14, w, 1);
			rect(c, OUT, x0 - 2, 24, 32, 3);
			rect(c, "#efe3cf", x0 - 1, 24, 30, 2);
		}
		box(c, "#c8ccd3", 208, 7, 48, 21);
		rect(c, "#fbfbf8", 209, 8, 46, 19);
		rect(c, "#e05a47", 212, 11, 12, 1);
		rect(c, "#5b6e8f", 228, 11, 10, 1);
		rect(c, "#7a8b3a", 228, 14, 6, 1);
		box(c, "#FBC222", 243, 9, 5, 5);
		box(c, "#f59ab5", 249, 10, 4, 4);
		rect(c, OUT, 212, 29, 40, 2);
		rect(c, "#9aa1ad", 213, 29, 38, 1);
		rect(c, "#e05a47", 216, 28, 3, 1);
		rect(c, "#5b6e8f", 221, 28, 3, 1);
		frame(c, 21, 9, 22, 13);
		rect(c, "#f3c98b", 22, 10, 20, 6);
		disc(c, 36, 13, 2, "#fbe3a0");
		rect(c, "#8a9a5b", 22, 16, 20, 5);
		rect(c, "#7a8b3a", 22, 18, 9, 3);
		frame(c, 164, 8, 11, 15);
		rect(c, "#FBC222", 165, 9, 9, 13);
		disc(c, 169, 14, 2, "#fbfbf8");
		rect(c, "#3b302c", 166, 19, 7, 1);
		frame(c, 182, 10, 19, 12);
		rect(c, "#7cc4d8", 183, 15, 17, 6);
		rect(c, "#e3f4fb", 185, 17, 4, 1);
		rect(c, "#8a9a5b", 183, 11, 17, 4);
		disc(c, 284, 13, 6, OUT);
		disc(c, 284, 13, 5, "#fbfbf8");
		rect(c, OUT, 284, 9, 1, 5);
		rect(c, OUT, 284, 13, 3, 1);
		rect(c, "#e05a47", 284, 13, 1, 1);
		box(c, "#fbfbf8", 258, 10, 8, 10);
		rect(c, "#d9694a", 258, 10, 8, 3);
		for (let k = 0; k < 6; k++) rect(c, "#c9b98a", 259 + k % 3 * 2, 14 + Math.floor(k / 3) * 3, 1, 1);
		frame(c, 325, 8, 18, 15);
		disc(c, 331, 14, 4, "#d9694a");
		rect(c, "#f4a259", 334, 15, 7, 6);
		rect(c, "#5b6e8f", 327, 19, 6, 2);
		box(c, "#2b2a33", 385, 7, 30, 17);
		rect(c, "#3a3944", 386, 8, 28, 15);
		for (const [k, hgt, col] of [
			[
				0,
				5,
				"#7a8b3a"
			],
			[
				1,
				9,
				"#e0b04a"
			],
			[
				2,
				7,
				"#7a8b3a"
			],
			[
				3,
				11,
				"#FBC222"
			]
		]) rect(c, col, 391 + k * 5, 21 - hgt, 3, hgt);
		rect(c, OUT, 398, 25, 4, 2);
		for (let i = 0; i < 13; i++) {
			const { seat } = deskOf(i);
			if (i === 12) {
				rect(c, OUT, seat.x - 9, seat.y - 31, 18, 20);
				rect(c, "#7a2e3a", seat.x - 8, seat.y - 30, 16, 18);
				rect(c, "#93404a", seat.x - 6, seat.y - 28, 12, 3);
				rect(c, "#5a1f2c", seat.x - 1, seat.y - 24, 2, 10);
				rect(c, "#FBC222", seat.x - 2, seat.y - 30, 4, 1);
				rect(c, OUT, seat.x - 11, seat.y - 18, 3, 7);
				rect(c, OUT, seat.x + 8, seat.y - 18, 3, 7);
				continue;
			}
			rect(c, OUT, seat.x - 7, seat.y - 23, 14, 12);
			rect(c, "#4a4048", seat.x - 6, seat.y - 22, 12, 10);
			rect(c, "#605560", seat.x - 5, seat.y - 21, 10, 2);
		}
		for (let x = 22; x <= 26; x++) {
			box(c, "#4a4048", x * 16 + 4, 54, 8, 8);
			rect(c, "#605560", x * 16 + 4, 54, 8, 2);
			box(c, "#4a4048", x * 16 + 4, 130, 8, 8);
			rect(c, "#605560", x * 16 + 4, 130, 8, 2);
		}
		return cv;
	}
	var NOTE_COLORS = [
		"#FBC222",
		"#7ed6a5",
		"#f59ab5",
		"#8ecbf5"
	];
	var PILE = 7;
	/** Pilha de folhas crescendo para cima a partir de (x, y) */
	function pile(c, x, y, n, sticky) {
		for (let k = 0; k < n; k++) {
			const dx = k * 5 % 3 - 1, yy = y - k * 2;
			rect(c, OUT, x + dx, yy, 8, 2);
			rect(c, k % 3 === 2 ? "#e9ebf0" : "#fbfbf8", x + dx + 1, yy, 6, 1);
		}
		if (sticky && n) rect(c, NOTE_COLORS[0], x + 2, y - (n - 1) * 2, 3, 1);
	}
	/** Riscos no quadro branco; o último pode estar sendo escrito (0..1, -1 = ninguém escrevendo) */
	function drawBoardMarks(c, marks, writing) {
		if (!marks.length && writing < 0) return;
		rect(c, "#fbfbf8", 209, 18, 46, 8);
		const all = (writing >= 0 ? [...marks, "#2b3556"] : marks).slice(-8);
		all.forEach((col, i) => {
			const full = 18 - i * 7 % 3 * 4;
			const len = writing >= 0 && i === all.length - 1 ? Math.max(1, Math.round(full * writing)) : full;
			rect(c, col, 211 + i % 2 * 24, 19 + Math.floor(i / 2) * 2, len, 1);
		});
	}
	/** Pasta que o boneco carrega na mão */
	function drawCarry(c, x, y) {
		rect(c, OUT, x, y, 7, 5);
		rect(c, "#e2b25a", x + 1, y + 1, 5, 3);
		rect(c, "#fbfbf8", x + 2, y, 3, 1);
	}
	function drawDesk(c, i, info) {
		const { tx, ty, w: wt } = deskOf(i);
		const x = tx * 16, y = ty * 16, w = wt * 16, m = x + w / 2;
		const boss = i === 12;
		rect(c, OUT, x - 1, y + 1, w + 2, 15);
		rect(c, boss ? "#6b3f22" : "#b07a4f", x, y + 2, w, 8);
		rect(c, boss ? "#8a5530" : "#c99566", x, y + 2, w, 1);
		rect(c, boss ? "#4a2a16" : "#8a5a36", x, y + 10, w, 5);
		rect(c, "#6e4529", x + 1, y + 15, 2, 1);
		rect(c, "#6e4529", x + w - 3, y + 15, 2, 1);
		if (boss) {
			rect(c, OUT, m - 9, y + 10, 18, 5);
			rect(c, "#3b2a20", m - 8, y + 11, 16, 3);
			rect(c, "#FBC222", m - 6, y + 12, 12, 1);
			rect(c, OUT, x + 6, y - 4, 1, 8);
			rect(c, "#FBC222", x + 4, y - 5, 5, 2);
		}
		if (!info.owned) {
			rect(c, "#9aa3b5", m - 4, y + 4, 8, 4);
			return;
		}
		rect(c, OUT, m - 7, y - 1, 14, 8);
		rect(c, "#c9ced8", m - 6, y, 12, 6);
		rect(c, info.busy ? Math.sin(info.t / 300) > -.3 ? "#FBC222" : "#ffd965" : "#9aa3b5", m - 1, y + 2, 2, 2);
		rect(c, "#9aa3b5", m - 7, y + 7, 14, 1);
		if (info.inbox && Math.sin(info.t / 220) > 0) {
			rect(c, OUT, m + 4, y - 3, 4, 4);
			rect(c, "#e5483a", m + 5, y - 2, 2, 2);
		}
		const n = info.pile, off = boss ? 10 : 0;
		if (n > PILE) pile(c, x + 1 + off, y + 7, Math.min(n - PILE, PILE), false);
		else {
			rect(c, "#ffffff", x + 3 + off, y + 4, 3, 4);
			rect(c, "#ffffff", x + 6 + off, y + 5, 1, 2);
		}
		pile(c, x + w - 9 - (boss ? 4 : 0), y + 7, Math.min(n, PILE), info.inbox);
		for (let k = 0; k < Math.min(n - 14, 6); k++) {
			const fx = x + 1 + k * 11 % (w - 8), fy = y + 17 + k % 2 * 3;
			rect(c, OUT, fx, fy, 7, 3);
			rect(c, "#fbfbf8", fx + 1, fy + 1, 5, 1);
		}
	}
	//#endregion
	exports.BOARD_SPOT = BOARD_SPOT;
	exports.BOSS_DESK = BOSS_DESK;
	exports.BOTTOMS = BOTTOMS;
	exports.DEFAULT_AVATAR = DEFAULT_AVATAR;
	exports.DESKS = DESKS;
	exports.HAIR_COLORS = HAIR_COLORS;
	exports.HAIR_STYLES = HAIR_STYLES;
	exports.MAX_DESKS = MAX_DESKS;
	exports.MH = MH;
	exports.MW = MW;
	exports.OUTFITS = OUTFITS;
	exports.SHELF_SPOT = SHELF_SPOT;
	exports.SHOES = SHOES;
	exports.SKINS = SKINS;
	exports.SPRITE_H = SPRITE_H;
	exports.SPRITE_W = SPRITE_W;
	exports.T = T;
	exports.TOPS = TOPS;
	exports.blocked = blocked;
	exports.bodySprite = bodySprite;
	exports.cellAt = cellAt;
	exports.deskAtTile = deskAtTile;
	exports.deskOf = deskOf;
	exports.drawAvatar = drawAvatar;
	exports.drawBoardMarks = drawBoardMarks;
	exports.drawCarry = drawCarry;
	exports.drawDesk = drawDesk;
	exports.findPath = findPath;
	exports.grid = grid;
	exports.onPhotoLoad = onPhotoLoad;
	exports.pathToSeat = pathToSeat;
	exports.renderBackground = renderBackground;
	exports.shade = shade;
	return exports;
})({});
