# Getting Started

1. On install run `npm run build` to make the script executable or `chmod u+x fp.js`

Examples:

- `cat ./files/hello.txt | ./fp.js --in --out`
- `cat ./files/hello.txt | ./fp.js --in --outfile=out.txt`
- `./fp.js file=./files/hello.txt`


Commands:

1. `-, --in` : read from stdin
2. `--file` : read from filepath
3. `--out` : write to stdout
4. `--outfile` : write to a specified outfile

If no file parameter is specified, and `--out` is not used. The script will write to `out.txt`

5. `--compress` : compress a file (gzip)
6. `--uncompress` : uncompress a file



## Notes on logging and stdout

0 stdin
1 stdout
2 stderr

`node fp.js > out.txt`  redirects output to a file
`node fp.js 1> out.txt` redirects stout to a file
`node fp.js 2> out.txt` redirects stderr to a file

to send both stdout and stderr to the same file run `node ./fp.js 2> out.txt 1>&2`
the `1>&2` sends stdout to the address of stderr. 