import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-8xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            404
          </h1>
          <h2 className="text-2xl font-bold mb-2">Página no encontrada</h2>
          <p className="text-muted-foreground">
            La página que buscas no existe o ha sido movida.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Volver al Inicio
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver Atrás
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
