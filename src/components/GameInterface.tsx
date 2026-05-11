import React, { useState } from 'react';

const InsetPanel = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <div className={`border-2 border-t-[#000000] border-l-[#000000] border-b-[#555555] border-r-[#555555] bg-[#1a1a1a] ${className}`}>
    {children}
  </div>
);

const OutsetButton = ({ children, className = '', active = false }: { children?: React.ReactNode; className?: string, active?: boolean }) => {
  const borderClasses = active 
    ? "border-2 border-t-[#000000] border-l-[#000000] border-b-[#555555] border-r-[#555555] bg-[#111111]"
    : "border-2 border-t-[#555555] border-l-[#555555] border-b-[#000000] border-r-[#000000] bg-[#2a2a2a] hover:bg-[#333333] cursor-pointer";
  
  return (
    <button className={`text-white font-bold text-[11px] px-2 py-1 ${borderClasses} ${className}`}>
      {children}
    </button>
  );
};

export const GameInterface = () => {
  const [activeTab, setActiveTab] = useState('Mgc');

  return (
    <div 
      className="h-screen w-screen overflow-hidden bg-black text-[#e0e0e0] select-none"
      style={{
        fontFamily: 'Tahoma, Verdana, sans-serif',
        fontSize: '11px',
        display: 'grid',
        gridTemplateColumns: '1fr 220px',
        gridTemplateRows: '45px 1fr 180px',
        gridTemplateAreas: `
          "top top"
          "canvas right"
          "chat right"
        `
      }}
    >
      {/* 1. Top HUD (Vitals & Info) */}
      <InsetPanel 
        className="flex items-center justify-between px-4"
        style={{ gridArea: 'top' }}
      >
        <div className="flex items-center space-x-8">
          <div className="flex flex-col">
            <span className="text-[#00ff00] font-bold">Buya</span>
            <span className="text-[10px]">045, 112</span>
          </div>
          
          <div className="flex items-center text-[#ffd700] font-bold">
            G: 14,250
          </div>
        </div>

        <div className="flex flex-col space-y-1 w-64">
          <div className="flex items-center">
            <span className="w-8 text-right mr-2 text-[10px]">HP</span>
            <div className="flex-1 h-3 bg-black border border-[#555]">
              <div className="h-full bg-[#ff0000]" style={{ width: '80%' }}></div>
            </div>
            <span className="w-12 text-right ml-1 text-[10px]">12000</span>
          </div>
          <div className="flex items-center">
            <span className="w-8 text-right mr-2 text-[10px]">MP</span>
            <div className="flex-1 h-3 bg-black border border-[#555]">
              <div className="h-full bg-[#0000ff]" style={{ width: '45%' }}></div>
            </div>
            <span className="w-12 text-right ml-1 text-[10px]">6500</span>
          </div>
        </div>

        <div className="flex flex-col text-right">
          <div>Lv: <span className="text-white">99</span></div>
          <div>Align: <span className="text-[#00ffff]">Good</span></div>
        </div>
      </InsetPanel>

      {/* 4. Center Game Canvas */}
      <div 
        className="bg-black relative overflow-hidden flex items-center justify-center"
        style={{ gridArea: 'canvas' }}
      >
        {/* Placeholder for PixiJS Canvas */}
        <div className="absolute inset-0 border-4 border-[#111] opacity-50 pointer-events-none z-10"></div>
        <div className="text-gray-600 text-lg border-2 border-dashed border-gray-600 p-8">
          PixiJS WebGL Canvas Area
        </div>
      </div>

      {/* 2. Right Sidebar (Controls & Spells) */}
      <InsetPanel 
        className="flex flex-col p-1"
        style={{ gridArea: 'right' }}
      >
        {/* Minimap / Radar */}
        <div className="w-full aspect-square bg-black border-2 border-t-[#000] border-l-[#000] border-b-[#555] border-r-[#555] mb-2 p-1 relative">
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="text-[9px] text-gray-500 absolute bottom-1 right-1">RADAR</div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-1">
          {['Mgc', 'Inv', 'Grp'].map(tab => (
            <OutsetButton 
              key={tab} 
              className="flex-1"
              active={activeTab === tab}
              // @ts-ignore
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </OutsetButton>
          ))}
        </div>

        {/* Quick Slots */}
        <div className="flex-1 bg-[#111] border-2 border-t-[#000] border-l-[#000] border-b-[#555] border-r-[#555] p-1 mb-2 overflow-y-auto">
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <div 
                key={i} 
                className="aspect-square bg-[#222] border border-t-[#000] border-l-[#000] border-b-[#444] border-r-[#444] hover:bg-[#333] cursor-pointer flex items-center justify-center text-[10px] text-gray-500"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Menu Buttons */}
        <div className="grid grid-cols-2 gap-1 mb-1">
          <OutsetButton>Status</OutsetButton>
          <OutsetButton>Magic</OutsetButton>
          <OutsetButton>Inv</OutsetButton>
          <OutsetButton>Group</OutsetButton>
          <OutsetButton className="col-span-2">Options</OutsetButton>
        </div>
      </InsetPanel>

      {/* 3. Bottom HUD (Chat Log) */}
      <InsetPanel 
        className="flex flex-col p-1"
        style={{ gridArea: 'chat' }}
      >
        {/* Chat Output */}
        <div className="flex-1 bg-black border-2 border-t-[#000] border-l-[#000] border-b-[#555] border-r-[#555] mb-1 p-2 overflow-y-auto font-sans flex flex-col justify-end space-y-1">
          <div className="text-[#ffff00]">[System] Welcome to Nexus!</div>
          <div className="text-[#ffffff]">Player1: Hello everyone!</div>
          <div className="text-[#00ff00]">Player2 whispers: hey want to group?</div>
          <div className="text-[#ff00ff]">[Clan] Leader: Raid starting soon.</div>
          <div className="text-[#00ffff]">[Group] Member: I need heals.</div>
        </div>

        {/* Chat Input Area */}
        <div className="flex items-center space-x-1 h-6">
          <div className="flex space-x-1 h-full">
            <OutsetButton className="px-1 text-[10px]">All</OutsetButton>
            <OutsetButton className="px-1 text-[10px]">Whsp</OutsetButton>
            <OutsetButton className="px-1 text-[10px]">Clan</OutsetButton>
          </div>
          <input 
            type="text" 
            className="flex-1 h-full bg-black text-white border-2 border-t-[#000] border-l-[#000] border-b-[#555] border-r-[#555] px-2 outline-none focus:border-gray-500"
            placeholder="Type a message..."
          />
        </div>
      </InsetPanel>
    </div>
  );
};
