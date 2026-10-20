import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_places_category" AS ENUM('restaurant', 'cafe', 'bar', 'bakery', 'shop', 'market', 'bank', 'hotel', 'townhall', 'government', 'embassy', 'court', 'post', 'museum', 'library', 'theatre', 'worship', 'monument', 'castle', 'school', 'hospital', 'station', 'port', 'airfield', 'portal', 'park', 'viewpoint', 'beach', 'farm', 'mine', 'workshop', 'residence', 'landmark', 'other');
  CREATE TYPE "public"."enum__places_v_version_category" AS ENUM('restaurant', 'cafe', 'bar', 'bakery', 'shop', 'market', 'bank', 'hotel', 'townhall', 'government', 'embassy', 'court', 'post', 'museum', 'library', 'theatre', 'worship', 'monument', 'castle', 'school', 'hospital', 'station', 'port', 'airfield', 'portal', 'park', 'viewpoint', 'beach', 'farm', 'mine', 'workshop', 'residence', 'landmark', 'other');
  CREATE TYPE "public"."enum_roads_kind" AS ENUM('highway', 'main', 'street', 'path', 'rail', 'iceroad', 'canal');
  CREATE TYPE "public"."enum__roads_v_version_kind" AS ENUM('highway', 'main', 'street', 'path', 'rail', 'iceroad', 'canal');
  CREATE TYPE "public"."enum_map_views_layers" AS ENUM('towns', 'places', 'roads', 'events');
  CREATE TYPE "public"."enum_map_views_aspect" AS ENUM('wide', 'square', 'banner');
  CREATE TYPE "public"."enum_map_views_map" AS ENUM('flat', 'biomes');
  CREATE TABLE "articles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"towns_id" integer,
  	"places_id" integer,
  	"events_id" integer
  );
  
  CREATE TABLE "_articles_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"towns_id" integer,
  	"places_id" integer,
  	"events_id" integer
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"towns_id" integer
  );
  
  CREATE TABLE "towns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"about" varchar,
  	"azanian" boolean,
  	"present" boolean DEFAULT true,
  	"synced_at" timestamp(3) with time zone,
  	"towny_id" varchar NOT NULL,
  	"nation" varchar,
  	"ruler" varchar,
  	"founded" varchar,
  	"culture" varchar,
  	"resident_count" numeric,
  	"chunks" numeric,
  	"residents" jsonb,
  	"home_x" numeric,
  	"home_y" numeric,
  	"home_z" numeric,
  	"claims" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "places" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"category" "enum_places_category" DEFAULT 'landmark' NOT NULL,
  	"description" varchar,
  	"point_x" numeric NOT NULL,
  	"point_y" numeric,
  	"point_z" numeric NOT NULL,
  	"outline" jsonb,
  	"town_id" integer,
  	"created_by_id" integer,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_places_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar NOT NULL,
  	"version_category" "enum__places_v_version_category" DEFAULT 'landmark' NOT NULL,
  	"version_description" varchar,
  	"version_point_x" numeric NOT NULL,
  	"version_point_y" numeric,
  	"version_point_z" numeric NOT NULL,
  	"version_outline" jsonb,
  	"version_town_id" integer,
  	"version_created_by_id" integer,
  	"version_updated_by_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "roads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"kind" "enum_roads_kind" DEFAULT 'street' NOT NULL,
  	"line" jsonb NOT NULL,
  	"town_id" integer,
  	"created_by_id" integer,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_roads_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_kind" "enum__roads_v_version_kind" DEFAULT 'street' NOT NULL,
  	"version_line" jsonb NOT NULL,
  	"version_town_id" integer,
  	"version_created_by_id" integer,
  	"version_updated_by_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone,
  	"place_id" integer,
  	"point_x" numeric,
  	"point_z" numeric,
  	"host" varchar,
  	"article_id" integer,
  	"town_id" integer,
  	"created_by_id" integer,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_description" varchar,
  	"version_starts_at" timestamp(3) with time zone NOT NULL,
  	"version_ends_at" timestamp(3) with time zone,
  	"version_place_id" integer,
  	"version_point_x" numeric,
  	"version_point_z" numeric,
  	"version_host" varchar,
  	"version_article_id" integer,
  	"version_town_id" integer,
  	"version_created_by_id" integer,
  	"version_updated_by_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "map_views_layers" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_map_views_layers",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "map_views" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"centre_x" numeric NOT NULL,
  	"centre_z" numeric NOT NULL,
  	"span" numeric DEFAULT 600 NOT NULL,
  	"aspect" "enum_map_views_aspect" DEFAULT 'wide' NOT NULL,
  	"map" "enum_map_views_map" DEFAULT 'flat' NOT NULL,
  	"drawings" jsonb,
  	"created_by_id" integer,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "town_census" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"date" varchar NOT NULL,
  	"town_id" integer NOT NULL,
  	"residents" numeric NOT NULL,
  	"chunks" numeric NOT NULL,
  	"nation" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "azania_maps_nations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "azania_maps_towns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "azania_maps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"synced_at" timestamp(3) with time zone,
  	"sync_note" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "cartographer" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "towns_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "places_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "map_views_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "town_census_id" integer;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_places_fk" FOREIGN KEY ("places_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_places_fk" FOREIGN KEY ("places_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "places" ADD CONSTRAINT "places_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "places" ADD CONSTRAINT "places_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "places" ADD CONSTRAINT "places_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_places_v" ADD CONSTRAINT "_places_v_parent_id_places_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_places_v" ADD CONSTRAINT "_places_v_version_town_id_towns_id_fk" FOREIGN KEY ("version_town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_places_v" ADD CONSTRAINT "_places_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_places_v" ADD CONSTRAINT "_places_v_version_updated_by_id_users_id_fk" FOREIGN KEY ("version_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roads" ADD CONSTRAINT "roads_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roads" ADD CONSTRAINT "roads_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roads" ADD CONSTRAINT "roads_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_roads_v" ADD CONSTRAINT "_roads_v_parent_id_roads_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."roads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_roads_v" ADD CONSTRAINT "_roads_v_version_town_id_towns_id_fk" FOREIGN KEY ("version_town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_roads_v" ADD CONSTRAINT "_roads_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_roads_v" ADD CONSTRAINT "_roads_v_version_updated_by_id_users_id_fk" FOREIGN KEY ("version_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_place_id_places_id_fk" FOREIGN KEY ("version_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_article_id_articles_id_fk" FOREIGN KEY ("version_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_town_id_towns_id_fk" FOREIGN KEY ("version_town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_updated_by_id_users_id_fk" FOREIGN KEY ("version_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "map_views_layers" ADD CONSTRAINT "map_views_layers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."map_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "map_views" ADD CONSTRAINT "map_views_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "map_views" ADD CONSTRAINT "map_views_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "town_census" ADD CONSTRAINT "town_census_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "azania_maps_nations" ADD CONSTRAINT "azania_maps_nations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."azania_maps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "azania_maps_towns" ADD CONSTRAINT "azania_maps_towns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."azania_maps"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
  CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
  CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
  CREATE INDEX "articles_rels_towns_id_idx" ON "articles_rels" USING btree ("towns_id");
  CREATE INDEX "articles_rels_places_id_idx" ON "articles_rels" USING btree ("places_id");
  CREATE INDEX "articles_rels_events_id_idx" ON "articles_rels" USING btree ("events_id");
  CREATE INDEX "_articles_v_rels_order_idx" ON "_articles_v_rels" USING btree ("order");
  CREATE INDEX "_articles_v_rels_parent_idx" ON "_articles_v_rels" USING btree ("parent_id");
  CREATE INDEX "_articles_v_rels_path_idx" ON "_articles_v_rels" USING btree ("path");
  CREATE INDEX "_articles_v_rels_towns_id_idx" ON "_articles_v_rels" USING btree ("towns_id");
  CREATE INDEX "_articles_v_rels_places_id_idx" ON "_articles_v_rels" USING btree ("places_id");
  CREATE INDEX "_articles_v_rels_events_id_idx" ON "_articles_v_rels" USING btree ("events_id");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_towns_id_idx" ON "users_rels" USING btree ("towns_id");
  CREATE UNIQUE INDEX "towns_slug_idx" ON "towns" USING btree ("slug");
  CREATE UNIQUE INDEX "towns_towny_id_idx" ON "towns" USING btree ("towny_id");
  CREATE INDEX "towns_updated_at_idx" ON "towns" USING btree ("updated_at");
  CREATE INDEX "towns_created_at_idx" ON "towns" USING btree ("created_at");
  CREATE INDEX "places_town_idx" ON "places" USING btree ("town_id");
  CREATE INDEX "places_created_by_idx" ON "places" USING btree ("created_by_id");
  CREATE INDEX "places_updated_by_idx" ON "places" USING btree ("updated_by_id");
  CREATE INDEX "places_updated_at_idx" ON "places" USING btree ("updated_at");
  CREATE INDEX "places_created_at_idx" ON "places" USING btree ("created_at");
  CREATE INDEX "_places_v_parent_idx" ON "_places_v" USING btree ("parent_id");
  CREATE INDEX "_places_v_version_version_town_idx" ON "_places_v" USING btree ("version_town_id");
  CREATE INDEX "_places_v_version_version_created_by_idx" ON "_places_v" USING btree ("version_created_by_id");
  CREATE INDEX "_places_v_version_version_updated_by_idx" ON "_places_v" USING btree ("version_updated_by_id");
  CREATE INDEX "_places_v_version_version_updated_at_idx" ON "_places_v" USING btree ("version_updated_at");
  CREATE INDEX "_places_v_version_version_created_at_idx" ON "_places_v" USING btree ("version_created_at");
  CREATE INDEX "_places_v_created_at_idx" ON "_places_v" USING btree ("created_at");
  CREATE INDEX "_places_v_updated_at_idx" ON "_places_v" USING btree ("updated_at");
  CREATE INDEX "roads_town_idx" ON "roads" USING btree ("town_id");
  CREATE INDEX "roads_created_by_idx" ON "roads" USING btree ("created_by_id");
  CREATE INDEX "roads_updated_by_idx" ON "roads" USING btree ("updated_by_id");
  CREATE INDEX "roads_updated_at_idx" ON "roads" USING btree ("updated_at");
  CREATE INDEX "roads_created_at_idx" ON "roads" USING btree ("created_at");
  CREATE INDEX "_roads_v_parent_idx" ON "_roads_v" USING btree ("parent_id");
  CREATE INDEX "_roads_v_version_version_town_idx" ON "_roads_v" USING btree ("version_town_id");
  CREATE INDEX "_roads_v_version_version_created_by_idx" ON "_roads_v" USING btree ("version_created_by_id");
  CREATE INDEX "_roads_v_version_version_updated_by_idx" ON "_roads_v" USING btree ("version_updated_by_id");
  CREATE INDEX "_roads_v_version_version_updated_at_idx" ON "_roads_v" USING btree ("version_updated_at");
  CREATE INDEX "_roads_v_version_version_created_at_idx" ON "_roads_v" USING btree ("version_created_at");
  CREATE INDEX "_roads_v_created_at_idx" ON "_roads_v" USING btree ("created_at");
  CREATE INDEX "_roads_v_updated_at_idx" ON "_roads_v" USING btree ("updated_at");
  CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");
  CREATE INDEX "events_place_idx" ON "events" USING btree ("place_id");
  CREATE INDEX "events_article_idx" ON "events" USING btree ("article_id");
  CREATE INDEX "events_town_idx" ON "events" USING btree ("town_id");
  CREATE INDEX "events_created_by_idx" ON "events" USING btree ("created_by_id");
  CREATE INDEX "events_updated_by_idx" ON "events" USING btree ("updated_by_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_starts_at_idx" ON "_events_v" USING btree ("version_starts_at");
  CREATE INDEX "_events_v_version_version_place_idx" ON "_events_v" USING btree ("version_place_id");
  CREATE INDEX "_events_v_version_version_article_idx" ON "_events_v" USING btree ("version_article_id");
  CREATE INDEX "_events_v_version_version_town_idx" ON "_events_v" USING btree ("version_town_id");
  CREATE INDEX "_events_v_version_version_created_by_idx" ON "_events_v" USING btree ("version_created_by_id");
  CREATE INDEX "_events_v_version_version_updated_by_idx" ON "_events_v" USING btree ("version_updated_by_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX "map_views_layers_order_idx" ON "map_views_layers" USING btree ("order");
  CREATE INDEX "map_views_layers_parent_idx" ON "map_views_layers" USING btree ("parent_id");
  CREATE INDEX "map_views_created_by_idx" ON "map_views" USING btree ("created_by_id");
  CREATE INDEX "map_views_updated_by_idx" ON "map_views" USING btree ("updated_by_id");
  CREATE INDEX "map_views_updated_at_idx" ON "map_views" USING btree ("updated_at");
  CREATE INDEX "map_views_created_at_idx" ON "map_views" USING btree ("created_at");
  CREATE UNIQUE INDEX "town_census_key_idx" ON "town_census" USING btree ("key");
  CREATE INDEX "town_census_date_idx" ON "town_census" USING btree ("date");
  CREATE INDEX "town_census_town_idx" ON "town_census" USING btree ("town_id");
  CREATE INDEX "town_census_updated_at_idx" ON "town_census" USING btree ("updated_at");
  CREATE INDEX "town_census_created_at_idx" ON "town_census" USING btree ("created_at");
  CREATE INDEX "azania_maps_nations_order_idx" ON "azania_maps_nations" USING btree ("_order");
  CREATE INDEX "azania_maps_nations_parent_id_idx" ON "azania_maps_nations" USING btree ("_parent_id");
  CREATE INDEX "azania_maps_towns_order_idx" ON "azania_maps_towns" USING btree ("_order");
  CREATE INDEX "azania_maps_towns_parent_id_idx" ON "azania_maps_towns" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_places_fk" FOREIGN KEY ("places_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roads_fk" FOREIGN KEY ("roads_id") REFERENCES "public"."roads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_map_views_fk" FOREIGN KEY ("map_views_id") REFERENCES "public"."map_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_town_census_fk" FOREIGN KEY ("town_census_id") REFERENCES "public"."town_census"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_towns_id_idx" ON "payload_locked_documents_rels" USING btree ("towns_id");
  CREATE INDEX "payload_locked_documents_rels_places_id_idx" ON "payload_locked_documents_rels" USING btree ("places_id");
  CREATE INDEX "payload_locked_documents_rels_roads_id_idx" ON "payload_locked_documents_rels" USING btree ("roads_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_map_views_id_idx" ON "payload_locked_documents_rels" USING btree ("map_views_id");
  CREATE INDEX "payload_locked_documents_rels_town_census_id_idx" ON "payload_locked_documents_rels" USING btree ("town_census_id");`)

  // Which towns are Azania's. Azania's towns are gathering in a Towny nation
  // still called Canada; Patown and GirlieTown count before they join. In
  // SQL rather than the local API, so later schema changes can't break it.
  // The first reading of the map happens on the first visit to /maps or at
  // the daily census, never here, so a deploy doesn't depend on the map.
  await db.execute(sql`
  INSERT INTO "azania_maps" ("id", "updated_at", "created_at") VALUES (1, now(), now()) ON CONFLICT ("id") DO NOTHING;
  SELECT setval(pg_get_serial_sequence('"azania_maps"', 'id'), GREATEST((SELECT MAX("id") FROM "azania_maps"), 1));
  INSERT INTO "azania_maps_nations" ("_order", "_parent_id", "id", "name") VALUES (1, 1, md5('azania-maps-nation-canada'), 'Canada');
  INSERT INTO "azania_maps_towns" ("_order", "_parent_id", "id", "name") VALUES
    (1, 1, md5('azania-maps-town-patown'), 'Patown'),
    (2, 1, md5('azania-maps-town-girlietown'), 'GirlieTown');`)
  payload.logger.info('Azania Maps: counting the Towny nation "Canada", plus Patown and GirlieTown')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "towns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "places" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_places_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "roads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_roads_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "map_views_layers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "map_views" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "town_census" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "azania_maps_nations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "azania_maps_towns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "azania_maps" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_rels" CASCADE;
  DROP TABLE "_articles_v_rels" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "towns" CASCADE;
  DROP TABLE "places" CASCADE;
  DROP TABLE "_places_v" CASCADE;
  DROP TABLE "roads" CASCADE;
  DROP TABLE "_roads_v" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "map_views_layers" CASCADE;
  DROP TABLE "map_views" CASCADE;
  DROP TABLE "town_census" CASCADE;
  DROP TABLE "azania_maps_nations" CASCADE;
  DROP TABLE "azania_maps_towns" CASCADE;
  DROP TABLE "azania_maps" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_towns_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_places_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_roads_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_map_views_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_town_census_fk";
  
  DROP INDEX "payload_locked_documents_rels_towns_id_idx";
  DROP INDEX "payload_locked_documents_rels_places_id_idx";
  DROP INDEX "payload_locked_documents_rels_roads_id_idx";
  DROP INDEX "payload_locked_documents_rels_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_map_views_id_idx";
  DROP INDEX "payload_locked_documents_rels_town_census_id_idx";
  ALTER TABLE "users" DROP COLUMN "cartographer";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "towns_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "places_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "roads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "map_views_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "town_census_id";
  DROP TYPE "public"."enum_places_category";
  DROP TYPE "public"."enum__places_v_version_category";
  DROP TYPE "public"."enum_roads_kind";
  DROP TYPE "public"."enum__roads_v_version_kind";
  DROP TYPE "public"."enum_map_views_layers";
  DROP TYPE "public"."enum_map_views_aspect";
  DROP TYPE "public"."enum_map_views_map";`)
}
