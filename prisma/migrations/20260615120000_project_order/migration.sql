-- Handmatige volgorde voor projecten (drag-and-drop in de Lopend-lijst)
ALTER TABLE "Project" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
