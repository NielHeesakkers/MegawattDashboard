-- Many-to-many join table between Project and Toeleverancier
CREATE TABLE "ProjectToeleverancier" (
  "projectId"        INTEGER NOT NULL,
  "toeleverancierId" INTEGER NOT NULL,
  PRIMARY KEY ("projectId", "toeleverancierId"),
  CONSTRAINT "ProjectToeleverancier_projectId_fkey"        FOREIGN KEY ("projectId")        REFERENCES "Project"("id")        ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectToeleverancier_toeleverancierId_fkey" FOREIGN KEY ("toeleverancierId") REFERENCES "Toeleverancier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectToeleverancier_projectId_idx"        ON "ProjectToeleverancier"("projectId");
CREATE INDEX "ProjectToeleverancier_toeleverancierId_idx" ON "ProjectToeleverancier"("toeleverancierId");
