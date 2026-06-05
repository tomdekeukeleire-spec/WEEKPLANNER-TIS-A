import React from 'react';
import { supabase } from '../supabase';

export default function LoginScreen() {
  const handleGoogleLogin = async () => {
    // Start de officiële Google OAuth-flow via Supabase
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Stuurt de gebruiker na inloggen direct terug naar de website
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto w-full max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-md shadow-blue-500/15 antialiased">
              C
            </div>
          </div>
          
          <h2 className="text-center text-2xl font-bold text-slate-800 tracking-tight mb-2">Weekplanner TIS-A</h2>
          <p className="text-center text-xs text-slate-400 font-medium tracking-wide uppercase mb-8">
            Samenwerkingsportaal • Veilig inloggen via TVH / Google
          </p>
          
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-all border border-slate-300 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.107C18.29 2.157 15.485 1 12.24 1c-6.077 0-11 4.923-11 11s4.923 11 11 11c6.34 0 10.557-4.444 10.557-10.743 0-.724-.078-1.277-.173-1.827H12.24z"/>
            </svg>
            Inloggen met TVH Account
          </button>
          
          <p className="text-[10px] text-slate-400 font-medium mt-6">
            Log in met uw browser-account. Alleen geautoriseerde teamleden hebben toegang.
          </p>
        </div>
      </div>
    </div>
  );
}
