import React from 'react';
import { NEWS_ITEMS } from '../../constants';
import { HexCard, HexButton } from '../UI/HextechUI';
import { ArrowRight, Zap } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="p-8 h-full overflow-y-auto">
      {/* Featured Hero */}
      <div className="relative w-full h-[350px] mb-8 group cursor-pointer overflow-hidden border border-[#333]">
        <img 
            src="https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt2a945d82098b6408/64e6740c037b3f172551e590/082823_Briar_Teaser_Banner.jpg" 
            alt="Hero" 
            className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/50 to-transparent"></div>
        
        {/* Decorative Grid on top of Hero */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3N2Zz4=')] opacity-20 pointer-events-none"></div>

        <div className="absolute bottom-0 left-0 p-8 w-2/3">
            <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#FF2A3A] text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest">Featured_Event</span>
                <span className="text-white text-[10px] uppercase tracking-widest">/// Priority_Alpha</span>
            </div>
            <h1 className="text-5xl font-black text-white mb-4 uppercase tracking-tighter italic">Feast of the <br/>Blood Moon</h1>
            <p className="text-[#CCC] mb-6 font-mono text-sm max-w-md border-l-2 border-[#FF2A3A] pl-4">The hunt begins. Join the celebration and earn exclusive rewards in the new limited-time mode.</p>
            <HexButton className="w-40 border-white hover:bg-white hover:text-black" variant="primary">Access_Data</HexButton>
        </div>
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {NEWS_ITEMS.map(news => (
            <HexCard key={news.id} className="group cursor-pointer h-full border-[#333] hover:border-white transition-all bg-[#0A0A0A]">
                <div className="h-40 mb-4 border border-[#333] relative overflow-hidden">
                    <img 
                        src={news.image} 
                        alt={news.title} 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                    />
                    <div className="absolute top-0 right-0 bg-white text-black px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                        {news.category}
                    </div>
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-2 truncate">{news.title}</h3>
                <p className="text-[#888] text-xs mb-4 line-clamp-2 font-mono">{news.description}</p>
                <div className="flex items-center text-[#FF2A3A] text-xs font-bold uppercase tracking-widest group-hover:text-white transition-colors">
                    Read_More <ArrowRight size={14} className="ml-2" />
                </div>
            </HexCard>
        ))}
      </div>
    </div>
  );
};