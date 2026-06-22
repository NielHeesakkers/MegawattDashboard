-- Extra locatiekenmerken: stroomvoorziening-type, aanvraagtijd, volume sampling, doelgroepen, event type
ALTER TABLE "Location" ADD COLUMN "stroomvoorzieningTypes" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Location" ADD COLUMN "aanvraagtijd" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Location" ADD COLUMN "volumeSampling" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Location" ADD COLUMN "doelgroepen" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Location" ADD COLUMN "eventTypes" TEXT NOT NULL DEFAULT '[]';
