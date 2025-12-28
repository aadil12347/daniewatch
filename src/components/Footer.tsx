import { Link } from "react-router-dom";
import { Film } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-cinema-darker border-t border-border py-12 mt-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg gradient-red flex items-center justify-center">
              <Film className="w-6 h-6 text-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Danie<span className="text-primary">Watch</span>
            </span>
          </Link>
        </div>

        {/* Copyright */}
        <div className="border-t border-border mt-10 pt-6 text-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} DanieWatch. Data provided by{" "}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              TMDB
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
