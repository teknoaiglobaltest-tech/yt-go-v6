import React from 'react';
import { Page } from '../types';
import Card from './Card';
import { PresentationChartBarIcon, CubeTransparentIcon, CurrencyDollarIcon, VideoCameraIcon, ExternalLinkIcon } from './icons/Icons';

interface HomeProps {
  setCurrentPage: (page: Page) => void;
}

const Home: React.FC<HomeProps> = ({ setCurrentPage }) => {
  const features = [
    { icon: <CubeTransparentIcon className="w-8 h-8 text-indigo-400" />, title: "1. Siapkan Aset", description: "Siapkan semua aset digital Anda: buat avatar AI, unggah foto produk, dan tambahkan lokasi latar." },
    { icon: <PresentationChartBarIcon className="w-8 h-8 text-indigo-400" />, title: "2. Buat Konten Iklan", description: "Gabungkan aset untuk membuat storyboard, gambar adegan, dan prompt video VEO yang siap pakai secara otomatis." },
    { icon: <VideoCameraIcon className="w-8 h-8 text-indigo-400" />, title: "3. Produksi Video", description: "Salin prompt VEO yang dihasilkan dan gunakan di platform video AI untuk membuat video final yang memukau." },
    { icon: <CurrencyDollarIcon className="w-8 h-8 text-indigo-400" />, title: "4. Posting & Cuan!", description: "Unggah video iklan Anda ke media sosial, jalankan kampanye, dan saksikan konversi penjualan Anda meningkat." }
  ];

  const tutorials = [
    { title: 'Cara Instal Ekstensi', url: 'https://www.youtube.com/watch?v=J46VHkr8iXA' },
    { title: 'Pengenalan & Cara Uploud Aset', url: 'https://www.youtube.com/watch?v=kAovy11LXVU' },
    { title: 'Buat Cerita, Tts & Video', url: 'https://www.youtube.com/watch?v=mz94wz8U4Po' },
    { title: 'Edit Simple Di Capcut', url: 'https://www.youtube.com/watch?v=yNe4AzyPdng' },
    { title: 'Uploud Dengan Paket SEO', url: 'https://www.youtube.com/watch?v=n0wgjGpLec8' }
  ];

  return (
    <div className="space-y-10">
      <div className="text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500">
            Cara Mudah Bikin Video AI
          </h1>
          <p className="mt-6 text-lg text-gray-300">
            Ubah ide Anda menjadi video profesional dengan bantuan avatar AI. Cepat, mudah, dan tanpa perlu syuting.
          </p>
        </div>

        <div className="max-w-5xl mx-auto mt-16">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-2 justify-center">
            <VideoCameraIcon className="w-8 h-8 text-indigo-400"/> TUTORIAL LENGKAP YT-GO
          </h2>
          <div className="space-y-4">
            {tutorials.map((tutorial, index) => (
              <Card key={index} className="p-4 flex items-center justify-between hover:border-indigo-500 transition-colors">
                <h3 className="font-semibold text-gray-200">{tutorial.title}</h3>
                <a 
                  href={tutorial.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center gap-2 font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  <ExternalLinkIcon className="w-4 h-4" />
                  Tonton Video
                </a>
              </Card>
            ))}
            <Card className="p-4 flex items-center justify-between hover:border-indigo-500 transition-colors bg-gradient-to-r from-purple-500/20 to-pink-500/20">
              <h3 className="font-semibold text-gray-200">AI Teks ke Suara (TTS)</h3>
              <a 
                href="https://gemini.google.com/share/ded6a6e92388" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-primary flex items-center gap-2 font-semibold py-2 px-4 rounded-lg text-sm"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                Buat Suara Natural
              </a>
            </Card>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-16">
          <h2 className="text-3xl font-bold mb-8">Alur Kerja Sederhana</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 text-left hover:border-indigo-500 transition-colors">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;