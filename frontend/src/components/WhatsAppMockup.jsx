import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function WhatsAppMockup({ className = '' }) {
  const { t } = useLanguage();
  const [visibleMessages, setVisibleMessages] = useState([]);

  useEffect(() => {
    let timeouts = [];
    let isMounted = true;

    const startSequence = () => {
      if (!isMounted) return;
      setVisibleMessages([]);
      
      timeouts.push(setTimeout(() => {
        if (isMounted) setVisibleMessages(prev => [...prev, { id: 1, type: 'incoming', text: t('phone_chat.greeting') || 'Good morning!' }]);
      }, 500));

      timeouts.push(setTimeout(() => {
        if (isMounted) setVisibleMessages(prev => [...prev, { id: 2, type: 'buttons', buttons: [t('phone_chat.btn_good') || 'Good', t('phone_chat.btn_ok') || 'Ok'] }]);
      }, 1500));

      timeouts.push(setTimeout(() => {
        if (isMounted) setVisibleMessages(prev => [...prev, { id: 3, type: 'incoming', text: t('phone_chat.lunch') || 'Had lunch?' }]);
      }, 3000));

      timeouts.push(setTimeout(() => {
        if (isMounted) setVisibleMessages(prev => [...prev, { id: 4, type: 'incoming', text: t('phone_chat.goodnight') || 'Goodnight!' }]);
      }, 5000));

      timeouts.push(setTimeout(() => {
        if (isMounted) startSequence();
      }, 8000));
    };

    startSequence();

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, [t]);

  return (
    <div className={`phone-perspective max-w-[280px] mx-auto ${className}`} data-testid="whatsapp-mockup">
      <motion.div 
        animate={{ y: [-5, 5, -5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="w-[270px] h-[560px] bg-white rounded-[36px] border-[6px] border-gray-800 shadow-2xl overflow-hidden flex flex-col relative"
        style={{ transform: 'rotateY(-8deg) rotateX(3deg)' }}
      >
        <div className="flex justify-center bg-gray-800 absolute top-0 w-full z-10">
          <div className="w-28 h-6 bg-gray-800 rounded-b-xl"></div>
        </div>

        <div className="bg-[#25D366] text-white p-3 pt-8 flex items-center gap-3 relative z-0">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
            👵
          </div>
          <div>
            <div className="font-semibold text-[15px]">Amma 💛</div>
            <div className="text-[11px] opacity-90">online</div>
          </div>
        </div>

        <div className="bg-[#EFEAE2] flex-1 p-4 flex flex-col gap-3 relative overflow-hidden">
          <AnimatePresence>
            {visibleMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className={`flex flex-col max-w-[85%] self-start`}
              >
                {msg.type === 'incoming' ? (
                  <div className="bg-[#DCF8C6] text-[#111B21] text-[13px] rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm relative">
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div className="text-[10px] text-gray-400 text-right mt-1">7:02 AM</div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {msg.buttons.map((btn, idx) => (
                      <div key={idx} className="bg-white border border-[#25D366] text-[#00A884] rounded-full px-4 py-1.5 text-[13px] font-medium shadow-sm">
                        {btn}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
      <div className="w-[180px] h-4 bg-black/10 blur-xl rounded-full mx-auto mt-4"></div>
    </div>
  );
}
