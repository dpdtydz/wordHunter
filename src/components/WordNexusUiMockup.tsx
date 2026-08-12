import React from 'react';

export const WordNexusUiMockup: React.FC<{ className?: string }> = ({ className = "w-full h-auto rounded-xl shadow-2xl" }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 900 520" 
      className={className}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        {/* Background Gradient */}
        <linearGradient id="compBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0a0d18"/>
          <stop offset="50%" stopColor="#121829"/>
          <stop offset="100%" stopColor="#070913"/>
        </linearGradient>

        {/* Card Glow / Hologram */}
        <linearGradient id="compHoloBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899"/>
          <stop offset="33%" stopColor="#8b5cf6"/>
          <stop offset="66%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#10b981"/>
        </linearGradient>

        <linearGradient id="compCardBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1f1a3a"/>
          <stop offset="100%" stopColor="#0d0b1a"/>
        </linearGradient>

        {/* Shiny Gold Glow */}
        <linearGradient id="compGoldText" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24"/>
          <stop offset="50%" stopColor="#fef08a"/>
          <stop offset="100%" stopColor="#f59e0b"/>
        </linearGradient>

        {/* Filters */}
        <filter id="compGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id="compCardShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#8b5cf6" floodOpacity="0.25"/>
        </filter>
      </defs>

      {/* Canvas Background */}
      <rect width="900" height="520" rx="16" fill="url(#compBgGrad)" stroke="#1e293b" strokeWidth="2"/>

      {/* Top Navbar / HUD Header */}
      <g transform="translate(24, 20)">
        <text x="0" y="24" fontFamily="'Segoe UI', Roboto, sans-serif" fontWeight="900" fontSize="22" fill="#f8fafc" letterSpacing="2">
          WORD<tspan fill="#8b5cf6">NEXUS</tspan>
        </text>
        
        <rect x="180" y="4" width="100" height="26" rx="13" fill="#1e1b4b" stroke="#6366f1" strokeWidth="1"/>
        <circle cx="194" cy="17" r="4" fill="#10b981"/>
        <text x="204" y="21" fontFamily="sans-serif" fontSize="11" fontWeight="700" fill="#a5b4fc">FARMING</text>

        <rect x="490" y="4" width="100" height="26" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
        <text x="502" y="21" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill="#fbbf24">Lv. 12</text>
        <rect x="546" y="12" width="36" height="10" rx="5" fill="#0f172a"/>
        <rect x="546" y="12" width="24" height="10" rx="5" fill="#f59e0b"/>

        <rect x="600" y="4" width="110" height="26" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
        <text x="616" y="21" fontFamily="sans-serif" fontSize="10" fontWeight="bold" fill="#78350f" textAnchor="middle">🪙</text>
        <text x="630" y="21" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill="#f8fafc">1,450</text>

        <rect x="720" y="4" width="130" height="26" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
        <text x="732" y="21" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill="#c084fc">📚 48 / 120</text>
      </g>

      <line x1="24" y1="62" x2="876" y2="62" stroke="#1e293b" strokeWidth="1"/>

      {/* Main Game Workspace */}
      <g transform="translate(32, 80)" filter="url(#compCardShadow)">
        <rect x="0" y="0" width="270" height="405" rx="16" fill="url(#compHoloBorder)" opacity="0.9"/>
        <rect x="3" y="3" width="264" height="399" rx="14" fill="url(#compCardBg)"/>

        <rect x="16" y="16" width="76" height="22" rx="11" fill="url(#compGoldText)"/>
        <text x="54" y="31" fontFamily="sans-serif" fontSize="11" fontWeight="900" fill="#451a03" textAnchor="middle">✨ SHINY</text>

        <rect x="150" y="16" width="98" height="22" rx="11" fill="#831843" stroke="#f43f5e" strokeWidth="1"/>
        <text x="199" y="31" fontFamily="sans-serif" fontSize="11" fontWeight="800" fill="#fecdd3" textAnchor="middle">LEGENDARY</text>

        <rect x="20" y="52" width="224" height="210" rx="10" fill="#0f172a" stroke="#3b0764" strokeWidth="2"/>
        <circle cx="132" cy="140" r="65" fill="#581c87" opacity="0.5" filter="url(#compGlow)"/>
        <path d="M 132 90 L 155 125 L 180 120 L 160 145 L 175 180 L 132 160 L 89 180 L 104 145 L 84 120 L 109 125 Z" fill="#c084fc" filter="url(#compGlow)"/>
        <circle cx="122" cy="130" r="4" fill="#fef08a"/>
        <circle cx="142" cy="130" r="4" fill="#fef08a"/>

        <text x="132" y="286" fontFamily="'Segoe UI', Roboto, sans-serif" fontSize="16" fontWeight="900" fill="url(#compGoldText)" textAnchor="middle">ASTRONOMER</text>
        <text x="132" y="306" fontFamily="sans-serif" fontSize="12" fill="#a7f3d0" textAnchor="middle">천문학자 · 별의 관측자</text>

        <rect x="20" y="322" width="224" height="62" rx="8" fill="#13112c" stroke="#2e1065" strokeWidth="1"/>
        <text x="32" y="344" fontFamily="sans-serif" fontSize="11" fill="#94a3b8">Soul Power:</text>
        <text x="100" y="344" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#38bdf8">9,420</text>
        <text x="160" y="344" fontFamily="sans-serif" fontSize="11" fill="#94a3b8">Card Lv:</text>
        <text x="212" y="344" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#f43f5e">MAX</text>

        <text x="32" y="368" fontFamily="sans-serif" fontSize="10" fill="#64748b">"밤하늘의 별자리 속에 감춰진 고대 문명을 관측한다."</text>
      </g>

      {/* Right Side: Word Guessing Game Board */}
      <g transform="translate(325, 80)">
        <rect x="0" y="0" width="540" height="90" rx="12" fill="#1e1b4b" stroke="#312e81" strokeWidth="1"/>
        <text x="20" y="28" fontFamily="sans-serif" fontSize="12" fontWeight="800" fill="#818cf8">
          CATEGORY: <tspan fill="#38bdf8">생명체 &amp; 지식인</tspan>
        </text>
        <rect x="420" y="14" width="100" height="22" rx="6" fill="#065f46"/>
        <text x="470" y="29" fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="#34d399" textAnchor="middle">HP: ♥♥♥♥♥</text>

        <text x="20" y="58" fontFamily="sans-serif" fontSize="13" fill="#cbd5e1">
          AI HINT: <tspan fill="#f1f5f9" fontStyle="italic">"A scientist who studies stars, planets, and celestial bodies in space."</tspan>
        </text>
        <text x="20" y="76" fontFamily="sans-serif" fontSize="12" fill="#94a3b8">한글 뜻: 별과 우주를 연구하고 별자리의 운명을 읽어내는 학자</text>

        <g transform="translate(0, 110)">
          {['A','S','T','R','O','N','O','_','_','R'].map((char, index) => {
            const isRevealed = char !== '_';
            return (
              <g key={index} transform={`translate(${index * 52}, 0)`}>
                <rect 
                  x="0" 
                  y="0" 
                  width="45" 
                  height="55" 
                  rx="8" 
                  fill={isRevealed ? "#1e293b" : "#0f172a"} 
                  stroke={isRevealed ? "#10b981" : "#334155"} 
                  strokeWidth="2"
                />
                {isRevealed ? (
                  <text x="22.5" y="38" fontFamily="sans-serif" fontSize="26" fontWeight="900" fill="#10b981" textAnchor="middle">
                    {char}
                  </text>
                ) : (
                  <line x1="15" y1="42" x2="30" y2="42" stroke="#64748b" strokeWidth="3"/>
                )}
              </g>
            );
          })}
        </g>

        {/* Onscreen Keyboard Matrix */}
        <g transform="translate(0, 185)">
          <rect x="0" y="0" width="540" height="210" rx="12" fill="#0f172a" stroke="#1e293b" strokeWidth="1"/>
          <text x="16" y="24" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill="#64748b">KEYBOARD INPUT</text>

          <g transform="translate(16, 38)">
            {['Q','W','E','R','T','Y','U','I','O','P'].map((k, i) => (
              <g key={k} transform={`translate(${i * 50}, 0)`}>
                <rect x="0" y="0" width="44" height="42" rx="6" fill={['R','T','O'].includes(k) ? "#065f46" : k === 'Y' ? "#881337" : "#1e293b"} stroke={['R','T','O'].includes(k) ? "#10b981" : undefined} strokeWidth="1"/>
                <text x="22" y="26" fontFamily="sans-serif" fontSize="15" fontWeight="bold" fill={['R','T','O'].includes(k) ? "#34d399" : k === 'Y' ? "#fda4af" : "#94a3b8"} textAnchor="middle">{k}</text>
              </g>
            ))}
          </g>

          <g transform="translate(40, 90)">
            {['A','S','D','F','G','H','J','K','L'].map((k, i) => (
              <g key={k} transform={`translate(${i * 50}, 0)`}>
                <rect x="0" y="0" width="44" height="42" rx="6" fill={['A','S'].includes(k) ? "#065f46" : "#1e293b"} stroke={['A','S'].includes(k) ? "#10b981" : undefined} strokeWidth="1"/>
                <text x="22" y="26" fontFamily="sans-serif" fontSize="15" fontWeight="bold" fill={['A','S'].includes(k) ? "#34d399" : "#94a3b8"} textAnchor="middle">{k}</text>
              </g>
            ))}
          </g>

          <g transform="translate(90, 142)">
            {['Z','X','C','V','B','N','M'].map((k, i) => (
              <g key={k} transform={`translate(${i * 50}, 0)`}>
                <rect x="0" y="0" width="44" height="42" rx="6" fill={k === 'N' ? "#065f46" : k === 'Z' ? "#881337" : "#1e293b"} stroke={k === 'N' ? "#10b981" : undefined} strokeWidth="1"/>
                <text x="22" y="26" fontFamily="sans-serif" fontSize="15" fontWeight="bold" fill={k === 'N' ? "#34d399" : k === 'Z' ? "#fda4af" : "#94a3b8"} textAnchor="middle">{k}</text>
              </g>
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
};
