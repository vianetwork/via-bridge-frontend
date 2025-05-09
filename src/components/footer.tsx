export default function Footer() {
  return (
    <footer className="w-full py-4 px-6 bg-slate-50 border-t border-slate-200 mt-auto">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
        <div className="mb-2 md:mb-0">
          <p>© {new Date().getFullYear()} VIA Network. All rights reserved.</p>
        </div>
        
        <div className="flex items-center gap-6">
          <a 
            href="#" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Documentation
          </a>
          <a 
            href="#" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Discord
          </a>
          <a 
            href="#" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            X
          </a>
          <a 
            href="#" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
