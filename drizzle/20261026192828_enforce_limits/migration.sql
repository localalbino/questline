-- Enforces the limits in db/boards.ts (MAX_BOARDS_PER_USER, MAX_GROUPS_PER_BOARD, MAX_CARDS_PER_GROUP)
-- in the database, so concurrent requests can't all pass the app's count check and go over.
-- Each trigger locks the parent row first, so writes into the same parent take turns, and the
-- count that follows takes a fresh snapshot that sees anything committed while it waited.
-- Keep the numbers and constraint names in sync with db/boards.ts.
CREATE FUNCTION enforce_boards_per_user() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.owner_id IS NOT DISTINCT FROM NEW.owner_id THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM "user" WHERE id = NEW.owner_id FOR NO KEY UPDATE;
  IF (SELECT count(*) FROM boards WHERE owner_id = NEW.owner_id) >= 3 THEN
    RAISE EXCEPTION 'Users can have at most 3 boards'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'boards_per_user_limit';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER boards_per_user_limit BEFORE INSERT OR UPDATE OF owner_id ON boards
  FOR EACH ROW EXECUTE FUNCTION enforce_boards_per_user();
--> statement-breakpoint
CREATE FUNCTION enforce_groups_per_board() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.board_id IS NOT DISTINCT FROM NEW.board_id THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM boards WHERE id = NEW.board_id FOR NO KEY UPDATE;
  IF (SELECT count(*) FROM groups WHERE board_id = NEW.board_id) >= 10 THEN
    RAISE EXCEPTION 'Boards can have at most 10 columns'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'groups_per_board_limit';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER groups_per_board_limit BEFORE INSERT OR UPDATE OF board_id ON groups
  FOR EACH ROW EXECUTE FUNCTION enforce_groups_per_board();
--> statement-breakpoint
CREATE FUNCTION enforce_cards_per_group() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Moves rewrite group_id on every card they renumber, so only count real changes.
  IF TG_OP = 'UPDATE' AND OLD.group_id IS NOT DISTINCT FROM NEW.group_id THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM groups WHERE id = NEW.group_id FOR NO KEY UPDATE;
  IF (SELECT count(*) FROM cards WHERE group_id = NEW.group_id) >= 50 THEN
    RAISE EXCEPTION 'Columns can have at most 50 games'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'cards_per_group_limit';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cards_per_group_limit BEFORE INSERT OR UPDATE OF group_id ON cards
  FOR EACH ROW EXECUTE FUNCTION enforce_cards_per_group();
