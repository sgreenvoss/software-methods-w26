

//First Attempt At algorithm skeleton (01/26/26):
type Resolver = (id: string) => number; // will likely be an enum or object

// Create a default tool (MVP Simple version)
const defaultResolver: Resolver = () => 3 // simplified for now to finish thinking through logic

// Function using "resolver/tool"
function checkPriority(id: string, resolver: Resolver) {
    // if no resolver provided, use default
    const calcPriority = resolver ?? defaultResolver;
    return calcPriority(id);
}



