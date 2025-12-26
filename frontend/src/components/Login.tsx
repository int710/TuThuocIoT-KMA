import React from "react";
import { Pill, Chrome, ArrowRight, Activity, IdCard } from "lucide-react";
import { User } from "../../types";

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const handleGoogleLogin = () => {
    // Simulated Google Login
    onLogin({
      name: "Bùi Thanh Quân - CT070242",
      email: "int04@gmail.com",
      picture: "https://actvn.edu.vn/Images/actvn_big_icon.png",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden font-inter">
      {/* Left side: Branding/Visual */}
      <div className="hidden md:flex flex-col justify-center bg-cyan-600 w-1/2 p-20 text-white relative">
        <div className="relative z-10 space-y-8 max-w-lg">
          <div className="bg-white/10 w-20 h-20 rounded-3xl flex items-center justify-center backdrop-blur-md">
            <Pill size={40} />
          </div>
          <div>
            <h1 className="text-5xl font-black mb-4 leading-tight">
              Giải pháp tủ thuốc thông minh thế hệ mới.
            </h1>
            <p className="text-xl text-indigo-100/80 font-medium">
              Quản lý sức khỏe, nhắc nhở uống thuốc và theo dõi các chỉ số sinh
              tồn theo thời gian thực.
            </p>
          </div>
          <div className="space-y-4">
            {[
              "Real-time Monitoring",
              "RFID Secured Access",
              "AI-Powered Insights",
              "Telegram Integration",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 font-semibold">
                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                {feature}
              </div>
            ))}
          </div>
        </div>
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-400 opacity-20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4"></div>
      </div>

      {/* Right side: Login form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white relative">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center md:text-left space-y-4">
            <div className="md:hidden flex justify-center mb-8">
              <div className="bg-cyan-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-100">
                <Pill size={32} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">
              Chào mừng trở lại
            </h2>
            <p className="text-slate-500 font-medium">
              Đăng nhập ngay để quản lý hệ thống tủ thuốc của bạn.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-4 py-4 px-6 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm active:scale-[0.98]"
            >
              <Chrome className="text-red-500" />
              Tiếp tục với Google
            </button>
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">
                  Hỗ trợ kỹ thuật
                </span>
              </div>
            </div>
            <p className="text-center text-slate-400 text-sm font-medium">
              Gặp khó khăn khi đăng nhập?{" "}
              <a href="#" className="text-indigo-600 font-bold hover:underline">
                Liên hệ hỗ trợ
              </a>
            </p>
          </div>

          <div className="pt-10 flex justify-center items-center gap-8 text-slate-300">
            <Activity size={32} />
            <IdCard size={32} />
            <Bot size={32} />
          </div>
        </div>
      </div>
    </div>
  );
};

const Bot: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

export default Login;
