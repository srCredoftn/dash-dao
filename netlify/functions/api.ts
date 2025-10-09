/**
Rôle: Module TypeScript — netlify/functions/api.ts
Domaine: Général
Exports: handler
Dépendances: serverless-http, ../../server
*/
import serverless from "serverless-http";

import { createServer } from "../../server";

export const handler = serverless(createServer());
