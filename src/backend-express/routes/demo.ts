/**
Rôle: Route API Express — src/backend-express/routes/demo.ts
Domaine: Backend/Routes
Exports: handleDemo
Dépendances: express, @shared/api
Liens: services (métier), middleware (auth, validation), repositories (persistance)
*/
import { RequestHandler } from "express";
import { DemoResponse } from "@shared/api";

export const handleDemo: RequestHandler = (_req, res) => {
  const response: DemoResponse = {
    message: "Hello from Express server",
  };
  res.status(200).json(response);
};
