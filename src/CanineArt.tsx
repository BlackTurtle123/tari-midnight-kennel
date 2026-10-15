import { VARIANTS } from '../shared/game';
export function CanineArt({ variant = 0, className = '' }: { variant?: number; className?: string }) {
 const v = VARIANTS[variant] || VARIANTS[0];
 return <svg viewBox="0 0 400 380" className={className} role="img" aria-label={v.name}>
 <ellipse cx="204" cy="346" rx="120" ry="16" fill="#242333" opacity=".12"/>
 <path d="M276 262 Q350 197 341 271 Q334 305 286 310" fill={v.coat} stroke="#302c3b" strokeWidth="9"/>
 <path d="M141 222 Q110 261 128 321 L132 342 Q150 355 171 342 L176 315 L226 315 L232 342 Q254 355 276 340 Q292 255 259 224Z" fill={v.coat} stroke="#302c3b" strokeWidth="9" strokeLinejoin="round"/>
 <ellipse cx="204" cy="280" rx="43" ry="49" fill="#fff5df"/>
 <path d="M124 114 Q63 46 74 160 Q78 203 122 193M276 114 Q339 46 328 160 Q322 203 282 193" fill={variant===5?'#57506e':'#906247'} stroke="#302c3b" strokeWidth="9" strokeLinejoin="round"/>
 <path d="M107 162 Q102 86 200 84 Q298 86 293 162 L292 205 Q274 253 201 251 Q120 251 109 210Z" fill={v.coat} stroke="#302c3b" strokeWidth="9"/>
 <path d="M158 93 Q178 81 202 85 L213 160 Q197 186 179 159Z" fill="#fff5df"/>
 <ellipse cx="151" cy="174" rx="10" ry="14" fill="#302c3b"/><ellipse cx="248" cy="174" rx="10" ry="14" fill="#302c3b"/>
 <circle cx="154" cy="170" r="3" fill="white"/><circle cx="251" cy="170" r="3" fill="white"/>
 <ellipse cx="201" cy="213" rx="43" ry="28" fill="#fff5df"/>
 <path d="M189 199 Q201 191 214 199 Q213 213 201 215 Q190 211 189 199" fill="#302c3b"/>
 <path d="M201 214V223 Q183 238 178 221M201 223 Q219 238 224 221" fill="none" stroke="#302c3b" strokeWidth="5" strokeLinecap="round"/>
 <path d="M193 230 Q202 237 211 230 Q213 251 201 251 Q191 250 193 230" fill="#e9939d"/>
 <path d="M132 246 Q201 268 270 246 L260 263 Q204 282 141 264Z" fill={v.accent} stroke="#302c3b" strokeWidth="5"/>
 <circle cx="202" cy="270" r="12" fill="#f6cf6b" stroke="#302c3b" strokeWidth="4"/><path d="M202 264V276M196 270H208" stroke="#302c3b" strokeWidth="3"/>
 {variant===0&&<g stroke="#302c3b" strokeWidth="5"><path d="M157 93 Q140 45 200 43 Q255 44 246 94Z" fill="#e88740"/><path d="M195 44 Q187 22 209 23" fill="none"/><path d="M177 71L184 62L192 73M212 72L221 61L229 73" fill="#302c3b"/><path d="M183 83H222"/></g>}
 {variant===1&&<path d="M203 18 Q163 41 206 66 Q151 65 165 30 Q179 9 203 18" fill="#f5cf78" stroke="#302c3b" strokeWidth="4"/>}
 {variant===2&&<path d="M163 91L200 21L239 91Z" fill="#ffebad" stroke="#302c3b" strokeWidth="5"/>}
 {variant===3&&<path d="M122 122 Q200 58 279 122 L272 143 Q249 127 233 141 Q212 124 193 140 Q167 125 146 145Z" fill="#f6f3e9" stroke="#302c3b" strokeWidth="4"/>}
 {variant===4&&<g stroke="#eee6d3" strokeWidth="15"><path d="M121 117L279 148M122 144L274 111M132 230L264 242"/></g>}
 {variant===5&&<path d="M145 102L107 36L100 124M255 102L293 36L300 124" fill="#8d85ae" stroke="#302c3b" strokeWidth="6" strokeLinejoin="round"/>}
 </svg>;
}
export function DoorArt({ index }: { index: number }) {
 const colors=['#eda867','#b9abe7','#9ac6ad'];
 return <svg viewBox="0 0 240 210" role="img" aria-label={['A pumpkin porch','A moonlit doorway','A haunted crypt'][index]}>
 <ellipse cx="120" cy="197" rx="87" ry="8" fill="#302c3b" opacity=".1"/>
 <path d="M55 191V78Q55 14 120 14Q185 14 185 78V191" fill={colors[index]} stroke="#302c3b" strokeWidth="5"/>
 <path d="M72 191V80Q72 33 120 33Q168 33 168 80V191Z" fill="#35303e"/>
 <path d="M84 187V82Q84 45 120 45Q156 45 156 82V187Z" fill={colors[index]} opacity=".4"/>
 <path d="M120 48V185M87 137H153" stroke="#302c3b" strokeWidth="4"/>
 <circle cx="142" cy="148" r="6" fill="#f6cf6b"/>
 {index===0?<g><ellipse cx="55" cy="174" rx="31" ry="25" fill="#ed924a" stroke="#302c3b" strokeWidth="4"/><path d="M55 149V137M39 170L48 161L54 172M59 173L66 163L73 175M43 182L66 184" stroke="#302c3b" strokeWidth="4" fill="#302c3b"/></g>:index===1?<path d="M196 26Q171 50 199 63Q158 69 166 41Q173 24 196 26" fill="#f4cf7c" stroke="#302c3b" strokeWidth="3"/>:<g><path d="M181 151Q180 126 203 126Q228 126 227 151V188L216 182L204 189L193 183L181 189Z" fill="#f7f2e5" stroke="#302c3b" strokeWidth="4"/><circle cx="196" cy="149" r="3"/><circle cx="213" cy="149" r="3"/></g>}
 <path d="M34 59V77M25 68H43M202 98V112M195 105H209" stroke="#302c3b" strokeWidth="3" strokeLinecap="round"/>
 </svg>;
}
