-- A privilege of its own for restructuring the tree.
--
-- Re-parenting changes who can see whose returns, which creating a
-- formation does not, so the two are no longer the same permission. This
-- also lets a formation be allowed to reorganise its own subordinates
-- without also being able to create formations anywhere in its scope.
ALTER TYPE "Privilege" ADD VALUE 'MOVE_FORMATIONS';
