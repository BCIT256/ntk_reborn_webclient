import React from 'react';

// Ornate panel to approximate the jade/wood look from the image
const OrnatePanel = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <div className={`bg-[#d2b48c] border-[6px] border-[#2e5c46] shadow-inner relative ${className}`} style={{
    backgroundImage: 'url("https://www.transparenttextures.com/patterns/aged-paper.png")'
  }}>
    {/* Decorative inner border */}
    <div className="absolute inset-0 border-[3px] border-[#8b5a2b] pointer-events-none opacity-50"></div>
    {children}
  </div>
);

const MenuButton = ({ children }: { children: React.ReactNode }) => (
  <button className="w-full bg-[#8b5a2b] hover:bg-[#a06833] text-[#ffe4c4] border-2 border-[#2e5c46] rounded-full py-1 my-1 shadow text-sm font-semibold tracking-wider relative group overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-10 transition-opacity"></div>
    {children}
  </button>
);

const StatBox = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex items-center justify-between bg-[#c2a278] border border-[#8b5a2b] rounded-full px-2 py-0.5 m-0.5 shadow-inner text-sm">
    <span className="font-bold text-[#5c3a21]">{label}</span>
    <span className="text-[#3e2716] bg-[#e6ceb3] px-2 rounded-full border border-[#8b5a2b]">{value}</span>
  </div>
);

export const GameInterface = () => {
  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex font-serif select-none">
      
      {/* Main View Area (Canvas + Bottom HUD) */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Floating Map Name */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-[#5a9c73] border-4 border-[#2e5c46] rounded-full px-12 py-1 shadow-lg relative">
            <div className="absolute inset-0 border border-[#a2e0bc] rounded-full pointer-events-none"></div>
            <h1 className="text-black font-bold text-xl drop-shadow-md">Seonhwa</h1>
          </div>
        </div>

        {/* Center Game Canvas Placeholder */}
        <div className="flex-1 bg-[#1a1a1a] relative overflow-hidden flex items-center justify-center border-r-2 border-[#2e5c46]">
          {/* Mock background pattern to look like grass/paving */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="text-gray-500 text-xl z-10 font-sans">PixiJS Game Canvas</div>
        </div>

        {/* Bottom HUD */}
        <div className="h-32 bg-[#2e5c46] border-t-4 border-[#1c382b] flex items-end p-2 pb-4 relative z-20">
          
          <div className="flex w-full items-end gap-4">
            {/* Chat/Menu Toggle */}
            <div className="w-16 h-12 bg-[#8b5a2b] border-4 border-[#1c382b] rounded-lg shadow-lg flex items-center justify-center cursor-pointer hover:bg-[#a06833]">
              <span className="text-[#ffe4c4] text-2xl">...</span>
            </div>

            {/* HP / MP & Quick Slots Container */}
            <div className="flex-1 flex flex-col items-center">
              
              {/* Vitals */}
              <div className="flex gap-4 mb-2 w-full max-w-2xl bg-[#1c382b] p-2 rounded-full border border-[#4a8a63] shadow-inner">
                {/* HP Bar */}
                <div className="flex-1 relative h-6 bg-black border border-gray-600 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-red-600" style={{ width: '100%' }}>
                    <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent opacity-20"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow-md">
                    3552/3552
                  </div>
                </div>

                {/* MP Bar */}
                <div className="flex-1 relative h-6 bg-black border border-gray-600 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-blue-500" style={{ width: '100%' }}>
                    <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent opacity-20"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow-md">
                    100/100
                  </div>
                </div>
              </div>

              {/* Quick Slots */}
              <div className="flex gap-1 justify-center">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="w-10 h-10 bg-[#8b5a2b] border-2 border-[#2e5c46] rounded shadow-inner flex items-center justify-center text-[#ffe4c4] text-xs font-bold hover:brightness-110 cursor-pointer relative">
                    {/* Mock Icon Letters */}
                    {['C', 'S', 'M'][i % 3]}
                    {/* Slot overlay */}
                    <div className="absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.6)] rounded pointer-events-none"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decorative right edge matching the image */}
            <div className="w-16 h-16 rounded-full bg-[#3b7a57] border-4 border-[#1c382b] self-end hidden lg:block"></div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-72 bg-[#2e5c46] flex flex-col shadow-2xl z-30 relative border-l-[8px] border-[#1c382b]">
        {/* Ornate corner decorative elements simulated with css */}
        
        <OrnatePanel className="flex-1 m-3 rounded-xl flex flex-col p-3 gap-2">
          
          <div className="text-center font-bold text-2xl text-[#5c3a21] border-b-2 border-[#8b5a2b] pb-2 mb-2 drop-shadow-sm">
            Menu
          </div>

          {/* Menu Buttons */}
          <div className="flex flex-col gap-1">
            <MenuButton>Inventory</MenuButton>
            <MenuButton>Character</MenuButton>
            <MenuButton>Spells</MenuButton>
            <MenuButton>Group</MenuButton>
            <MenuButton>Quests</MenuButton>
            <MenuButton>Friends</MenuButton>
            <MenuButton>Clan</MenuButton>
            <MenuButton>Map</MenuButton>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Log Window */}
          <div className="h-32 bg-[#e6ceb3] border-4 border-[#4a8a63] rounded p-2 text-sm text-[#3e2716] overflow-y-auto shadow-inner">
            Your helmet is no longer visible.
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-1 mt-2">
            <StatBox label="CON" value="36" />
            <StatBox label="WIS" value="9" />
            <StatBox label="INT" value="7" />
            <StatBox label="STR" value="88" />
            <StatBox label="DEX" value="27" />
            <div className="flex gap-1">
              <StatBox label="X" value="156" />
              <StatBox label="Y" value="71" />
            </div>
          </div>

          {/* Level Bar */}
          <div className="mt-2 bg-[#5a9c73] border-2 border-[#2e5c46] rounded-full px-3 py-1 text-center text-sm font-bold text-[#1a3b2a] shadow-inner">
            Lv: 41 <span className="ml-2 font-normal">TNL: 8816</span>
          </div>

        </OrnatePanel>
      </div>

    </div>
  );
};