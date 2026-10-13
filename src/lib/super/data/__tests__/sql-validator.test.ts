import { describe, expect, it } from 'vitest';
import { validateReadOnlySql as v } from '../sql-validator';

const ok = (q: string) => expect(v(q).ok, q).toBe(true);
const bad = (q: string) => expect(v(q).ok, q).toBe(false);

describe('validateReadOnlySql', () => {
  it('accepts normal reads', () => {
    ok('SELECT * FROM users');
    ok('select 1;');
    ok('  SELECT 1 ; -- trailing comment');
    ok('WITH a AS (SELECT 1) SELECT * FROM a');
    ok('EXPLAIN QUERY PLAN SELECT * FROM users');
    ok('PRAGMA table_info(users)');
    ok('PRAGMA table_info("users")');
    ok("SELECT replace(name, 'a', 'b') FROM users");
    ok("SELECT 'DROP TABLE users; DELETE FROM x' AS s");
    ok('SELECT "delete", [update] FROM t');
    ok("SELECT 'it''s; fine'");
    ok('SELECT created_at, updated_at, end_date FROM t'); // keywords only as part of identifiers
  });
  it('allows CASE ... END but refuses protected columns and runaway recursion', () => {
    ok("SELECT CASE WHEN role = 'student' THEN 1 ELSE 0 END AS s FROM users");
    bad('SELECT push_subscription AS x FROM users');
    bad('SELECT substr(push_subscription, 1, 999) FROM users');
    bad('SELECT "auth_token" FROM t');
    bad('WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM c) SELECT count(*) FROM c');
  });
  it('rejects multi statements', () => {
    bad('SELECT 1; DROP TABLE users');
    bad('SELECT 1;; SELECT 2');
    bad('SELECT 1 ;/* x */; DELETE FROM users');
    bad('SELECT 1;--\nDROP TABLE users');
    bad('SELECT 1;\u0000DROP TABLE users');
  });
  it('rejects write / DDL keywords anywhere, any case', () => {
    bad('DELETE FROM users');
    bad('WITH x AS (SELECT 1) DELETE FROM users');
    bad('WITH x AS (SELECT 1) UPDATE users SET role = 1');
    bad('WITH x AS (SELECT 1) INSERT INTO users SELECT * FROM x');
    bad('sElEcT 1 /**/ uNiOn /**/ dRoP');
    bad('SELECT * FROM users WHERE id IN (DELETE FROM users)');
    bad('REPLACE INTO users VALUES (1)');
    bad('SELECT 1 FROM users WHERE x = 1 -- \n; DROP TABLE users');
    bad('CREATE TABLE x (a)');
    bad('ALTER TABLE users ADD c');
    bad('ATTACH DATABASE "a.db" AS a');
    bad('VACUUM');
    bad('BEGIN');
    bad('SELECT load_extension("x")');
    bad('SELECT writefile("a", "b")');
    bad('SELECT zeroblob(1000000000)');
  });
  it('rejects unsafe pragmas', () => {
    bad('PRAGMA writable_schema = 1');
    bad('PRAGMA foreign_keys = OFF');
    bad('PRAGMA journal_mode');
    bad('PRAGMA table_info(users) ; PRAGMA x');
    bad('PRAGMA table_info = 1');
    bad('SELECT 1 FROM users WHERE x IN (PRAGMA table_info(users))');
  });
  it('rejects unterminated strings/comments and non-reads', () => {
    bad("SELECT 'abc");
    bad('SELECT 1 /* open');
    bad('SELECT "abc');
    bad('');
    bad('   ');
    bad('EXPLAIN DELETE FROM users');
    bad('VALUES (1)');
    bad('/* SELECT */ DELETE FROM users');
    bad('\u0000SELECT 1');
  });
  it('treats unicode lookalikes as plain identifiers, not keywords', () => {
    ok('SELECT 1 AS drоp'); // cyrillic o inside an alias
  });
  it('strips comments from the executed text', () => {
    const r = v('SELECT 1 -- hi\n, 2 /* x */ FROM t;');
    expect(r.ok && r.sql.replace(/\s+/g, ' ')).toBe('SELECT 1 , 2 FROM t');
  });
});
